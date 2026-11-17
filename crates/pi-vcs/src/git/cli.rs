//! The deliberately small git-CLI escape hatch.
//!
//! Three categories are allowed to spawn `git`, per the hybrid policy:
//! - **Credential-bound network transfers** — clone/fetch/push must reuse the
//!   user's ssh config and credential helpers, which are subprocess-based by
//!   design; no library reaches auth parity (and gitoxide has no send-pack).
//! - **Reftable ref access** — no in-process reftable implementation exists.
//! - **Whole-worktree status/untracked walks** — a subprocess contains gitoxide
//!   worker-thread spawn failures under host resource exhaustion.
//!
//! The runner ports the hardened subprocess contract of the TS wrapper:
//! non-interactive env (`GIT_TERMINAL_PROMPT=0`, askpass rejection, `LC_ALL`
//! handling), `--no-optional-locks` for reads, fsmonitor/untracked-cache
//! disabled for writes, ambient `GIT_DIR`-family vars stripped, bounded output
//! capture, and deadline + SIGTERM→SIGKILL termination via tokio.

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
use std::process::Stdio;
use std::{ffi::OsStr, path::Path, time::Duration};

use tokio::io::AsyncReadExt;
use tokio_util::sync::CancellationToken;

use super::GitRepo;
use crate::{
	error::{Error, Result},
	types::{CloneOptions, PushOptions},
};

/// Default deadline for local git plumbing via the fallback runner.
pub const COMMAND_TIMEOUT: Duration = Duration::from_mins(5);
/// Default deadline for network transfers (`clone`/`fetch`/`push`); large-repo
/// transfers legitimately outlive [`COMMAND_TIMEOUT`].
pub const NETWORK_TIMEOUT: Duration = Duration::from_mins(30);
/// Deadline for synchronous plumbing on render paths (reftable HEAD reads):
/// a stalled invocation degrades instead of freezing the UI.
pub const SYNC_TIMEOUT: Duration = Duration::from_secs(5);
/// Maximum captured bytes per stream before truncation.
pub const OUTPUT_LIMIT_BYTES: usize = 8 * 1024 * 1024;

const TERMINATE_GRACE: Duration = Duration::from_secs(5);
const TRUNCATION_MARKER: &str = "\n[git subprocess output truncated at the capture limit]\n";

/// Captured result of a completed git invocation.
#[derive(Debug, Clone)]
pub(crate) struct CliOutput {
	/// Process exit code (`124` designates a deadline kill).
	pub exit_code: i32,
	/// Captured stdout, possibly truncated.
	pub stdout:    String,
	/// Captured stderr, possibly truncated.
	pub stderr:    String,
}

impl CliOutput {
	/// Convert a non-zero exit into [`Error::Cli`].
	pub fn into_checked(self, args: &[String]) -> Result<Self> {
		if self.exit_code == 0 {
			return Ok(self);
		}
		Err(Error::Cli {
			command:   format!("git {}", args.join(" ")),
			exit_code: self.exit_code,
			stdout:    self.stdout,
			stderr:    self.stderr,
		})
	}
}

/// Options for one fallback invocation.
#[derive(Debug, Default)]
pub(crate) struct RunOptions {
	/// Prefix `--no-optional-locks` instead of pinning fsmonitor/untracked-cache
	/// off.
	pub read_only: bool,
	/// Deadline; [`COMMAND_TIMEOUT`] when unset.
	pub timeout:   Option<Duration>,
	/// Bytes piped to stdin (commit messages, `update-ref --stdin` scripts).
	pub stdin:     Option<Vec<u8>>,
	/// Cooperative cancellation: the child is terminated when triggered.
	pub cancel:    Option<CancellationToken>,
}

/// Build the hardened argv prefix.
///
/// Reads get `--no-optional-locks`, which already keeps them from rewriting
/// the index, so they keep the repository's fsmonitor and untracked cache: a
/// whole-worktree status on a large repo polled by every open session is far
/// cheaper with both. Writes pin both off so a transient subprocess never
/// mutates fsmonitor/untracked-cache state in the index.
fn hardened_args(args: &[String], read_only: bool) -> Vec<String> {
	let mut out = Vec::with_capacity(args.len() + 4);
	if read_only {
		if !args.iter().any(|arg| arg == "--no-optional-locks") {
			out.push("--no-optional-locks".to_owned());
		}
	} else {
		for pin in ["core.fsmonitor=false", "core.untrackedCache=false"] {
			out.push("-c".to_owned());
			out.push(pin.to_owned());
		}
	}
	out.extend(args.iter().cloned());
	out
}

/// Environment sink for the two command builders. `std::process::Command` and
/// `tokio::process::Command` share no trait, and duplicating the contract per
/// builder is how the synchronous path silently lost the `LC_ALL` removal that
/// [`is_dubious_ownership`] depends on.
trait EnvSink {
	fn set(&mut self, key: &str, value: &str);
	fn unset(&mut self, key: &str);
}

impl EnvSink for std::process::Command {
	fn set(&mut self, key: &str, value: &str) {
		self.env(key, value);
	}

	fn unset(&mut self, key: &str) {
		self.env_remove(key);
	}
}

impl EnvSink for tokio::process::Command {
	fn set(&mut self, key: &str, value: &str) {
		self.env(key, value);
	}

	fn unset(&mut self, key: &str) {
		self.env_remove(key);
	}
}

/// The child's whole environment, for spawners that take it complete: the
/// host's variables with [`apply_env`] applied on top.
#[cfg(any(target_os = "macos", target_os = "linux"))]
struct ChildEnv(Vec<(std::ffi::OsString, std::ffi::OsString)>);

#[cfg(any(target_os = "macos", target_os = "linux"))]
impl ChildEnv {
	fn inherited() -> Self {
		Self(std::env::vars_os().collect())
	}

	fn set_os(&mut self, key: &OsStr, value: &OsStr) {
		self.0.retain(|(k, _)| k != key);
		self.0.push((key.to_owned(), value.to_owned()));
	}
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
impl EnvSink for ChildEnv {
	fn set(&mut self, key: &str, value: &str) {
		self.set_os(OsStr::new(key), OsStr::new(value));
	}

	fn unset(&mut self, key: &str) {
		self.0.retain(|(k, _)| k != key);
	}
}

/// `program` with `argv` in `cwd`, in a new session with no controlling
/// terminal (see [`detach_from_terminal`]), environment per [`apply_env`]
/// plus `extra`. Spawned through `posix_spawn`: std would fork to `setsid`
/// here, and a fork stalls every other host thread (the TUI's event loop) on
/// macOS for tens of milliseconds.
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub(crate) fn detached_command(
	program: &OsStr,
	argv: &[impl AsRef<OsStr>],
	cwd: &Path,
	extra: &[(&str, &OsStr)],
	hardened: bool,
) -> pi_spawn::Command {
	let mut env = ChildEnv::inherited();
	if hardened {
		apply_env(&mut env);
	}
	for (key, value) in extra {
		env.set_os(OsStr::new(key), value);
	}
	let mut cmd = pi_spawn::Command::new(program);
	cmd.args(argv)
		.current_dir(cwd)
		.env_exact(env.0)
		.place(pi_spawn::Place::Session);
	cmd
}

/// Apply the non-interactive environment contract to a command builder:
/// prompts rejected, editors disabled, ambient repo-location and pathspec
/// overrides stripped, `LC_MESSAGES=C` for parseable errors while preserving a
/// UTF-8 character locale. `LC_ALL` must go: it outranks `LC_MESSAGES`, so
/// leaving it inherited would hand back localized diagnostics.
///
/// The `*_PATHSPECS` variables are global pathspec modes, so an inherited
/// `GIT_LITERAL_PATHSPECS=1` would make the `:(literal)` magic this crate
/// builds match a filename containing that prefix (i.e. nothing), and
/// `GIT_ICASE_PATHSPECS=1` would match case variants the caller did not ask
/// for. Explicit magic is only explicit once they are gone.
fn apply_env(cmd: &mut impl EnvSink) {
	for stripped in [
		"GIT_DIR",
		"GIT_COMMON_DIR",
		"GIT_WORK_TREE",
		"GIT_INDEX_FILE",
		"GIT_OBJECT_DIRECTORY",
		"GIT_ALTERNATE_OBJECT_DIRECTORIES",
		"GIT_LITERAL_PATHSPECS",
		"GIT_GLOB_PATHSPECS",
		"GIT_NOGLOB_PATHSPECS",
		"GIT_ICASE_PATHSPECS",
	] {
		cmd.unset(stripped);
	}
	if let Some(lc_all) = std::env::var_os("LC_ALL") {
		let lc_all = lc_all.to_string_lossy().into_owned();
		if is_utf8_locale(&lc_all) {
			cmd.set("LC_CTYPE", &lc_all);
		}
	}
	cmd.unset("LC_ALL");
	cmd.set("LC_MESSAGES", "C");
	cmd.set("GIT_OPTIONAL_LOCKS", "0");
	cmd.set("GIT_ASKPASS", "true");
	cmd.set("GIT_EDITOR", "true");
	cmd.set("GIT_TERMINAL_PROMPT", "0");
	cmd.set("SSH_ASKPASS", "false");
}

/// Loose match for a UTF-8 character locale (`en_US.UTF-8`, `C.utf8`, …).
fn is_utf8_locale(value: &str) -> bool {
	let lower = value.to_ascii_lowercase();
	["utf-8", "utf8"].iter().any(|needle| {
		lower
			.split(['.', '_', '-', '@'])
			.any(|part| part == *needle)
			|| lower.ends_with(needle)
			|| lower.contains(&format!(".{needle}"))
	})
}

/// Start `cmd` in a new session with no controlling terminal, the embedded
/// shell's policy for externals. Without it git and everything it starts (ssh,
/// credential helpers, signers, hooks) share the host's terminal: any of them
/// can read the user's keystrokes and the terminal's protocol replies out from
/// under the TUI, or prompt on it. Detached, a `/dev/tty` open fails
/// (`ENXIO`), so a prompt errors out instead. macOS and Linux spawn through
/// [`detached_command`] instead, which detaches without forking.
#[cfg(all(unix, not(any(target_os = "macos", target_os = "linux"))))]
pub(crate) fn detach_from_terminal(cmd: &mut std::process::Command) {
	std::os::unix::process::CommandExt::setsid(cmd, true);
}

#[cfg(not(unix))]
#[allow(
	clippy::needless_pass_by_ref_mut,
	reason = "no controlling terminal to detach from off unix; the signature matches the unix \
	          variant"
)]
pub(crate) const fn detach_from_terminal(_cmd: &mut std::process::Command) {}

/// A running git whose exit the async runner can await.
#[cfg(any(target_os = "macos", target_os = "linux"))]
struct AsyncChild {
	/// `None` only once dropped.
	child:  Option<pi_spawn::Child>,
	/// Completes once the child has exited, without reaping it: the pid stays
	/// ours until [`pi_spawn::Child`] reaps it, so signals never reach a
	/// reused pid.
	exited: Option<tokio::task::JoinHandle<()>>,
}

/// A runner dropped mid-wait (cancelled, timed out with git surviving
/// SIGKILL in an uninterruptible wait) must neither leave git running nor
/// block a runtime worker on the final reap, as `kill_on_drop` did not.
#[cfg(any(target_os = "macos", target_os = "linux"))]
impl Drop for AsyncChild {
	fn drop(&mut self) {
		let Some(mut child) = self.child.take() else {
			return;
		};
		if matches!(child.try_wait(), Ok(Some(_))) {
			return;
		}
		let _ = child.kill();
		match tokio::runtime::Handle::try_current() {
			Ok(runtime) => drop(runtime.spawn_blocking(move || drop(child))),
			Err(_) => drop(child),
		}
	}
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
impl AsyncChild {
	fn spawn(
		cwd: &Path,
		argv: &[String],
		stdin: bool,
	) -> Result<(
		Self,
		Option<tokio::net::unix::pipe::Sender>,
		tokio::net::unix::pipe::Receiver,
		tokio::net::unix::pipe::Receiver,
	)> {
		use std::os::fd::OwnedFd;
		let mode = if stdin {
			pi_spawn::Stdin::Piped
		} else {
			pi_spawn::Stdin::Null
		};
		let mut child = detached_command(OsStr::new("git"), argv, cwd, &[], true)
			.spawn_child(mode)
			.map_err(|err| spawn_error(cwd, err))?;
		let writer = child
			.stdin
			.take()
			.map(|w| tokio::net::unix::pipe::Sender::from_owned_fd(OwnedFd::from(w)))
			.transpose()
			.map_err(Error::Io)?;
		let stdout = child.stdout.take().expect("stdout piped");
		let stderr = child.stderr.take().expect("stderr piped");
		let stdout = tokio::net::unix::pipe::Receiver::from_owned_fd(OwnedFd::from(stdout))
			.map_err(Error::Io)?;
		let stderr = tokio::net::unix::pipe::Receiver::from_owned_fd(OwnedFd::from(stderr))
			.map_err(Error::Io)?;
		let pid = child.id();
		let exited = tokio::task::spawn_blocking(move || wait_exited(pid));
		Ok((Self { child: Some(child), exited: Some(exited) }, writer, stdout, stderr))
	}

	/// Whether the child exits within `limit` (forever when `None`).
	async fn exited(&mut self, limit: Option<Duration>) -> bool {
		let Some(handle) = self.exited.as_mut() else {
			return true;
		};
		let done = if let Some(limit) = limit {
			tokio::time::timeout(limit, handle).await.is_ok()
		} else {
			let _ = handle.await;
			true
		};
		if done {
			self.exited = None;
		}
		done
	}

	const fn child(&mut self) -> &mut pi_spawn::Child {
		self.child.as_mut().expect("child present until drop")
	}

	async fn wait(&mut self) -> std::io::Result<std::process::ExitStatus> {
		self.exited(None).await;
		self.child().wait()
	}

	/// SIGTERM, grace period, then SIGKILL.
	async fn terminate(&mut self) {
		let _ = self.child().signal(libc::SIGTERM);
		if !self.exited(Some(TERMINATE_GRACE)).await {
			let _ = self.child().kill();
			let _ = self.exited(Some(TERMINATE_GRACE)).await;
		}
		let _ = self.child().try_wait();
	}
}

/// Block until `pid` has exited, leaving it unreaped. A stop is not an exit:
/// on macOS `waitid(WEXITED)` also reports stops, and treating one as the
/// exit would put a blocking reap of a live git on a runtime worker.
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn wait_exited(pid: libc::pid_t) {
	let _ = pi_spawn::wait_exit(pid, |_| {});
}

/// Run `git` asynchronously with bounded capture and a deadline.
/// Non-zero exits are returned in [`CliOutput`], not raised.
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub(crate) async fn run(cwd: &Path, args: &[String], options: &RunOptions) -> Result<CliOutput> {
	let argv = hardened_args(args, options.read_only);
	let (mut child, writer, stdout, stderr) =
		AsyncChild::spawn(cwd, &argv, options.stdin.is_some())?;

	if let Some(stdin) = &options.stdin
		&& let Some(mut pipe) = writer
	{
		use tokio::io::AsyncWriteExt;
		// A child that exits early (e.g. usage error) closes the pipe;
		// that is its answer, not ours to fail on.
		let _ = pipe.write_all(stdin).await;
		let _ = pipe.shutdown().await;
	}

	let stdout_task = tokio::spawn(read_capped(stdout));
	let stderr_task = tokio::spawn(read_capped(stderr));

	let timeout = options.timeout.unwrap_or(COMMAND_TIMEOUT);
	let cancel = options.cancel.clone().unwrap_or_default();
	let exit = tokio::select! {
		status = tokio::time::timeout(timeout, child.wait()) => match status {
			Ok(status) => status.map_err(Error::Io)?,
			Err(_elapsed) => {
				child.terminate().await;
				stdout_task.abort();
				stderr_task.abort();
				return Err(Error::CliTimeout { command: format!("git {}", argv.join(" ")) });
			},
		},
		() = cancel.cancelled() => {
			child.terminate().await;
			stdout_task.abort();
			stderr_task.abort();
			return Err(Error::Canceled);
		},
	};

	let stdout = stdout_task
		.await
		.map_err(|err| Error::backend("git run", err))??;
	let stderr = stderr_task
		.await
		.map_err(|err| Error::backend("git run", err))??;
	Ok(CliOutput { exit_code: exit.code().unwrap_or(-1), stdout, stderr })
}

/// Run `git` asynchronously with bounded capture and a deadline.
/// Non-zero exits are returned in [`CliOutput`], not raised.
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub(crate) async fn run(cwd: &Path, args: &[String], options: &RunOptions) -> Result<CliOutput> {
	let argv = hardened_args(args, options.read_only);
	let mut cmd = tokio::process::Command::new("git");
	cmd.args(&argv)
		.current_dir(cwd)
		.stdin(if options.stdin.is_some() {
			Stdio::piped()
		} else {
			Stdio::null()
		})
		.stdout(Stdio::piped())
		.stderr(Stdio::piped())
		.kill_on_drop(true);
	apply_env(&mut cmd);
	detach_from_terminal(cmd.as_std_mut());
	let mut child = cmd.spawn().map_err(|err| spawn_error(cwd, err))?;

	if let Some(stdin) = &options.stdin
		&& let Some(mut pipe) = child.stdin.take()
	{
		use tokio::io::AsyncWriteExt;
		// A child that exits early (e.g. usage error) closes the pipe;
		// that is its answer, not ours to fail on.
		let _ = pipe.write_all(stdin).await;
		let _ = pipe.shutdown().await;
	}

	let stdout = child.stdout.take().expect("stdout piped");
	let stderr = child.stderr.take().expect("stderr piped");
	let stdout_task = tokio::spawn(read_capped(stdout));
	let stderr_task = tokio::spawn(read_capped(stderr));

	let timeout = options.timeout.unwrap_or(COMMAND_TIMEOUT);
	let cancel = options.cancel.clone().unwrap_or_default();
	let exit = tokio::select! {
		status = tokio::time::timeout(timeout, child.wait()) => match status {
			Ok(status) => status.map_err(Error::Io)?,
			Err(_elapsed) => {
				terminate(&mut child).await;
				stdout_task.abort();
				stderr_task.abort();
				return Err(Error::CliTimeout { command: format!("git {}", argv.join(" ")) });
			},
		},
		() = cancel.cancelled() => {
			terminate(&mut child).await;
			stdout_task.abort();
			stderr_task.abort();
			return Err(Error::Canceled);
		},
	};

	let stdout = stdout_task
		.await
		.map_err(|err| Error::backend("git run", err))??;
	let stderr = stderr_task
		.await
		.map_err(|err| Error::backend("git run", err))??;
	Ok(CliOutput { exit_code: exit.code().unwrap_or(-1), stdout, stderr })
}

/// Run `git` asynchronously and map a non-zero exit to [`Error::Cli`].
pub(crate) async fn run_checked(
	cwd: &Path,
	args: &[String],
	options: &RunOptions,
) -> Result<CliOutput> {
	run(cwd, args, options).await?.into_checked(args)
}

/// Whether `err` means the git binary could not be launched at all (missing
/// binary or deleted cwd), as opposed to git running and failing. Callers with
/// an in-process fallback (e.g. porcelain status) branch on this.
pub(crate) fn is_spawn_failure(err: &Error) -> bool {
	matches!(err, Error::Backend { context: "git spawn", .. })
}

/// Whether captured output hit [`OUTPUT_LIMIT_BYTES`] and therefore lost
/// bytes. Callers whose output is a value rather than a diagnostic (path
/// lists) must retry in-process or fail, never return the short result.
pub(crate) fn is_truncated(text: &str) -> bool {
	text.ends_with(TRUNCATION_MARKER)
}

/// Whether git refused the checkout under its `safe.directory` ownership
/// check (`fatal: detected dubious ownership`, exit 128), which happens
/// whenever the process user differs from the checkout owner — a
/// host-mounted repository inside a container is the common case.
///
/// `open::open_options` opens user-chosen checkouts with `Trust::Full` on
/// purpose, so the in-process walk has no such objection: a caller with a
/// gitoxide fallback must take it rather than surface an error the
/// library-backed path would never have produced.
///
/// [`apply_env`] pins `LC_MESSAGES=C` and drops the `LC_ALL` that would
/// outrank it, so the English wording is what git emits. `safe.directory` is
/// matched as well: it is a config key, so it survives translation even if a
/// host manages to localize the diagnostic anyway.
pub(crate) fn is_dubious_ownership(err: &Error) -> bool {
	matches!(
		err,
		Error::Cli { exit_code: 128, stderr, .. }
			if stderr.contains("dubious ownership") || stderr.contains("safe.directory")
	)
}

/// Whether `err` describes a CLI that could not do the work at all while the
/// in-process gitoxide path still can.
pub(crate) fn prefers_in_process(err: &Error) -> bool {
	is_spawn_failure(err) || is_dubious_ownership(err)
}

/// Synchronous bounded runner with a caller-chosen deadline; render paths pass
/// [`SYNC_TIMEOUT`] so a stalled git cannot freeze the UI. Stdout/stderr are
/// drained concurrently with capped retention, so output larger than the OS
/// pipe buffer can never stall the child into a spurious timeout.
pub(crate) fn run_sync(cwd: &Path, args: &[String], timeout: Duration) -> Result<CliOutput> {
	run_sync_capped(cwd, args, timeout, OUTPUT_LIMIT_BYTES)
}

/// Stdin and environment for a [`run_sync_write`] invocation.
pub(crate) struct SyncWrite<'a> {
	/// Bytes piped to the child's stdin, then closed.
	pub stdin: &'a [u8],
	/// Variables set after [`apply_env`], so they win over its contract.
	pub env:   &'a [(&'a str, &'a OsStr)],
}

/// Synchronous runner for local write plumbing (fsmonitor/untracked-cache
/// pinned off) that feeds `input.stdin` and sets `input.env` on the child.
pub(crate) fn run_sync_write(
	cwd: &Path,
	args: &[String],
	timeout: Duration,
	input: &SyncWrite<'_>,
) -> Result<CliOutput> {
	run_sync_impl(cwd, args, timeout, OUTPUT_LIMIT_BYTES, Some(input))
}

/// [`run_sync`] with an explicit retention cap. The cap is a parameter rather
/// than a constant read inside the reader threads so a test can exercise the
/// truncation contract on one call without lowering the limit for every other
/// invocation in the process.
pub(crate) fn run_sync_capped(
	cwd: &Path,
	args: &[String],
	timeout: Duration,
	limit: usize,
) -> Result<CliOutput> {
	run_sync_impl(cwd, args, timeout, limit, None)
}

/// Shared synchronous runner: read-only when `write` is `None`.
fn run_sync_impl(
	cwd: &Path,
	args: &[String],
	timeout: Duration,
	limit: usize,
	write: Option<&SyncWrite<'_>>,
) -> Result<CliOutput> {
	let argv = hardened_args(args, write.is_none());
	let mut child = spawn_sync(cwd, &argv, write).map_err(|err| spawn_error(cwd, err))?;
	let stdout = spawn_sync_reader("git-cli-stdout", child.stdout.take(), limit);
	let stderr = spawn_sync_reader("git-cli-stderr", child.stderr.take(), limit);
	std::thread::scope(|scope| {
		// The writer runs beside the deadline loop: a child that stops reading
		// must still be killed on time, and the kill closes the pipe, which
		// unblocks the writer before the scope joins it.
		if let Some(write) = write
			&& let Some(mut pipe) = child.stdin.take()
		{
			let writer = std::thread::Builder::new()
				.name("git-cli-stdin".into())
				.spawn_scoped(scope, move || {
					use std::io::Write;
					// A child that exits early closes the pipe; its exit status
					// is the answer, not this write error.
					let _ = pipe.write_all(write.stdin);
				});
			if let Err(err) = writer {
				// The dropped pipe reads as an empty input; the child must not
				// act on it.
				let _ = child.kill();
				let _ = child.wait();
				return Err(Error::backend("git spawn stdin writer", err));
			}
		}
		wait_sync(&argv, child, stdout, stderr, timeout)
	})
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
type SyncChild = pi_spawn::Child;
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
type SyncChild = std::process::Child;

/// Start `git` for [`run_sync_impl`]: stdout/stderr piped, stdin piped for a
/// write, else `/dev/null`.
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn spawn_sync(
	cwd: &Path,
	argv: &[String],
	write: Option<&SyncWrite<'_>>,
) -> std::io::Result<SyncChild> {
	let extra = write.map_or(&[][..], |w| w.env);
	let mode = if write.is_some() {
		pi_spawn::Stdin::Piped
	} else {
		pi_spawn::Stdin::Null
	};
	detached_command(OsStr::new("git"), argv, cwd, extra, true).spawn_child(mode)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn spawn_sync(
	cwd: &Path,
	argv: &[String],
	write: Option<&SyncWrite<'_>>,
) -> std::io::Result<SyncChild> {
	let mut cmd = std::process::Command::new("git");
	cmd.args(argv)
		.current_dir(cwd)
		.stdin(if write.is_some() {
			Stdio::piped()
		} else {
			Stdio::null()
		})
		.stdout(Stdio::piped())
		.stderr(Stdio::piped());
	apply_env(&mut cmd);
	detach_from_terminal(&mut cmd);
	if let Some(write) = write {
		for (key, value) in write.env {
			cmd.env(key, value);
		}
	}
	cmd.spawn()
}

/// Drain stdout and stderr to EOF and reap the child.
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub(crate) fn collect_output(
	mut child: pi_spawn::Child,
) -> std::io::Result<(std::process::ExitStatus, Vec<u8>, Vec<u8>)> {
	use std::io::Read;
	let mut stderr_pipe = child.stderr.take();
	let stderr = std::thread::Builder::new()
		.name("git-hook-stderr".into())
		.spawn(move || {
			let mut buf = Vec::new();
			if let Some(pipe) = stderr_pipe.as_mut() {
				let _ = pipe.read_to_end(&mut buf);
			}
			buf
		})?;
	let mut stdout = Vec::new();
	if let Some(mut pipe) = child.stdout.take() {
		let _ = pipe.read_to_end(&mut stdout);
	}
	let stderr = stderr.join().unwrap_or_default();
	Ok((child.wait()?, stdout, stderr))
}

/// Deadline loop and output collection for [`run_sync_impl`].
fn wait_sync(
	argv: &[String],
	mut child: SyncChild,
	stdout: Option<std::thread::JoinHandle<String>>,
	stderr: Option<std::thread::JoinHandle<String>>,
	timeout: Duration,
) -> Result<CliOutput> {
	let deadline = std::time::Instant::now() + timeout;
	let status = loop {
		match child.try_wait()? {
			Some(status) => break Some(status),
			None if std::time::Instant::now() >= deadline => {
				let _ = child.kill();
				let _ = child.wait();
				break None;
			},
			None => std::thread::sleep(Duration::from_millis(10)),
		}
	};
	// The child has exited (or been killed), so the pipes reach EOF and the
	// readers terminate; join can only block briefly on the final drain.
	let stdout = stdout.map_or_default(|h| h.join().unwrap_or_default());
	let stderr = stderr.map_or_default(|h| h.join().unwrap_or_default());
	let Some(status) = status else {
		return Err(Error::CliTimeout { command: format!("git {}", argv.join(" ")) });
	};
	Ok(CliOutput { exit_code: status.code().unwrap_or(-1), stdout, stderr })
}

/// Drain a child stream on a helper thread, mirroring [`read_capped`].
///
/// `None` when the stream is absent or the thread cannot be spawned (e.g.
/// under the same memory pressure that motivates the CLI path); dropping the
/// stream then closes the pipe, so a chatty child fails with EPIPE and
/// surfaces as a non-zero exit instead of a hang.
fn spawn_sync_reader(
	name: &'static str,
	stream: Option<impl std::io::Read + Send + 'static>,
	limit: usize,
) -> Option<std::thread::JoinHandle<String>> {
	let stream = stream?;
	std::thread::Builder::new()
		.name(name.into())
		.spawn(move || read_capped_sync(stream, limit))
		.ok()
}

/// Synchronous mirror of [`read_capped`]: cap retention at `limit` while
/// draining to EOF so the child never blocks.
fn read_capped_sync(mut stream: impl std::io::Read, limit: usize) -> String {
	let mut retained: Vec<u8> = Vec::new();
	let mut buf = [0u8; 8 * 1024];
	let mut truncated = false;
	loop {
		let n = match stream.read(&mut buf) {
			Ok(0) | Err(_) => break,
			Ok(n) => n,
		};
		if truncated {
			continue;
		}
		let remaining = limit - retained.len();
		if n <= remaining {
			retained.extend_from_slice(&buf[..n]);
		} else {
			retained.extend_from_slice(&buf[..remaining]);
			truncated = true;
		}
	}
	let mut text = String::from_utf8_lossy_owned(retained);
	if truncated {
		text.push_str(TRUNCATION_MARKER);
	}
	text
}

fn spawn_error(cwd: &Path, err: std::io::Error) -> Error {
	if err.kind() == std::io::ErrorKind::NotFound {
		// A deleted cwd also surfaces as spawn ENOENT; only blame the binary
		// when the working directory actually exists.
		let message = if cwd.exists() {
			"git is not installed.".to_owned()
		} else {
			format!("working directory does not exist: {}", cwd.display())
		};
		return Error::backend("git spawn", message);
	}
	Error::Io(err)
}

/// Read a stream to completion, capping retention at [`OUTPUT_LIMIT_BYTES`]
/// while continuing to drain so the child never blocks on a full pipe.
async fn read_capped(mut stream: impl tokio::io::AsyncRead + Unpin) -> Result<String> {
	let mut retained: Vec<u8> = Vec::new();
	let mut buf = [0u8; 8 * 1024];
	let mut truncated = false;
	loop {
		let n = stream.read(&mut buf).await.map_err(Error::Io)?;
		if n == 0 {
			break;
		}
		if truncated {
			continue;
		}
		let remaining = OUTPUT_LIMIT_BYTES - retained.len();
		if n <= remaining {
			retained.extend_from_slice(&buf[..n]);
		} else {
			retained.extend_from_slice(&buf[..remaining]);
			truncated = true;
		}
	}
	let mut text = String::from_utf8_lossy_owned(retained);
	if truncated {
		text.push_str(TRUNCATION_MARKER);
	}
	Ok(text)
}

/// SIGTERM, grace period, then SIGKILL.
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
async fn terminate(child: &mut tokio::process::Child) {
	#[cfg(unix)]
	if let Some(pid) = child.id() {
		// SAFETY: plain kill(2) on a pid we own; no memory is touched.
		unsafe {
			libc::kill(pid as i32, libc::SIGTERM);
		}
		if tokio::time::timeout(TERMINATE_GRACE, child.wait())
			.await
			.is_ok()
		{
			return;
		}
	}
	let _ = child.kill().await;
	let _ = tokio::time::timeout(TERMINATE_GRACE, child.wait()).await;
}

// ═══════════════════════════════════════════════════════════════════════════
// Network operations (public API)
// ═══════════════════════════════════════════════════════════════════════════

impl GitRepo {
	/// Push the current branch (branch-scoped: never follows tags).
	///
	/// `--no-follow-tags` overrides a user's `push.followTags = true`, which
	/// would otherwise ride every reachable annotated tag along with the
	/// branch — rejected refs on remotes the user cannot tag (e.g. PR-head
	/// forks) would fail the call after the branch itself already updated.
	pub async fn push(
		&self,
		options: &PushOptions,
		cancel: Option<CancellationToken>,
	) -> Result<()> {
		let mut args = vec!["push".to_owned(), "--no-follow-tags".to_owned()];
		if options.force_with_lease {
			args.push("--force-with-lease".to_owned());
		}
		if let Some(remote) = &options.remote {
			args.push(remote.clone());
		}
		if let Some(refspec) = &options.refspec {
			args.push(refspec.clone());
		}
		run_checked(self.root(), &args, &RunOptions {
			timeout: Some(NETWORK_TIMEOUT),
			cancel,
			..RunOptions::default()
		})
		.await?;
		Ok(())
	}

	/// Fetch `+source:target` from a remote.
	pub async fn fetch(
		&self,
		remote: &str,
		source: &str,
		target: &str,
		timeout: Option<Duration>,
		cancel: Option<CancellationToken>,
	) -> Result<()> {
		let args = vec!["fetch".to_owned(), remote.to_owned(), format!("+{source}:{target}")];
		run_checked(self.root(), &args, &RunOptions {
			timeout: Some(timeout.unwrap_or(NETWORK_TIMEOUT)),
			cancel,
			..RunOptions::default()
		})
		.await?;
		Ok(())
	}
}

/// Clone `url` into `target_dir`, removing the partial clone on any failure.
///
/// Shallow (`--depth 1 --single-branch`) unless a specific SHA is pinned:
/// a shallow clone only fetches the tip, so checking out a non-tip commit
/// would fail with "reference is not a tree".
pub async fn clone(
	url: &str,
	target_dir: &Path,
	options: &CloneOptions,
	cancel: Option<CancellationToken>,
) -> Result<()> {
	let absolute = std::path::absolute(target_dir)?;
	let parent = absolute
		.parent()
		.map_or_else(|| absolute.clone(), Path::to_owned);
	tokio::fs::create_dir_all(&parent).await?;

	let shallow = options.sha.is_none();
	let mut args = vec!["clone".to_owned()];
	if shallow {
		args.push("--depth".to_owned());
		args.push("1".to_owned());
	}
	if let Some(ref_name) = &options.ref_name {
		args.push("--branch".to_owned());
		args.push(ref_name.clone());
		args.push("--single-branch".to_owned());
	} else if shallow {
		args.push("--single-branch".to_owned());
	}
	args.push(url.to_owned());
	args.push(absolute.to_string_lossy().into_owned());

	let run_options = RunOptions {
		timeout: Some(options.timeout.unwrap_or(NETWORK_TIMEOUT)),
		cancel: cancel.clone(),
		..RunOptions::default()
	};
	let outcome = run_checked(&parent, &args, &run_options).await;
	if let Err(err) = outcome {
		let _ = tokio::fs::remove_dir_all(&absolute).await;
		return Err(err);
	}

	if let Some(sha) = &options.sha {
		let checkout = run_checked(&absolute, &["checkout".to_owned(), sha.clone()], &RunOptions {
			cancel,
			..RunOptions::default()
		})
		.await;
		if checkout.is_err() {
			let _ = tokio::fs::remove_dir_all(&absolute).await;
			return Err(Error::backend(
				"git clone",
				format!("failed to checkout SHA {sha} in cloned repository {url}"),
			));
		}
	}
	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;

	/// Set on the re-executed child; carries the fixture repository it should
	/// probe. Its presence is what tells the test body which side it is on.
	const ENV_PROBE_REPO: &str = "PI_VCS_TEST_ENV_PROBE_REPO";

	/// Asks git to report the ambient variables it was started with. A `!`-alias
	/// is the only way to make git print its own environment.
	const ENV_PROBE_ALIAS: &str = r#"!printf 'LC_ALL=[%s] LC_CTYPE=[%s] LC_MESSAGES=[%s] LITERAL=[%s] ICASE=[%s]' "$LC_ALL" "$LC_CTYPE" "$LC_MESSAGES" "$GIT_LITERAL_PATHSPECS" "$GIT_ICASE_PATHSPECS""#;

	/// A git left in the host's process group shares its terminal and can read
	/// the TUI's keystrokes and terminal replies (Tern TSP events leaked into
	/// the composer with their leading bytes missing). Both runners must start
	/// it in its own session.
	#[cfg(unix)]
	#[tokio::test]
	async fn runners_start_git_outside_the_host_process_group() {
		let dir = tempfile::tempdir().expect("tempdir");
		let args = ["-c".to_owned(), "alias.pgid=!ps -o pgid= -p $$".to_owned(), "pgid".to_owned()];
		// SAFETY: getpgrp has no preconditions.
		let host = unsafe { libc::getpgrp() };
		let sync = run_sync(dir.path(), &args, SYNC_TIMEOUT).expect("sync runner");
		let spawned = run(dir.path(), &args, &RunOptions::default())
			.await
			.expect("async runner");
		for out in [sync, spawned] {
			assert_eq!(out.exit_code, 0, "alias failed: {out:?}");
			let pgid: i32 = out.stdout.trim().parse().expect("pgid");
			assert_ne!(pgid, host, "git shares the host's process group: {out:?}");
		}
	}

	/// On macOS a fork blocks every other host thread inside malloc until the
	/// child execs; the status line's git poll froze the TUI's event loop for
	/// ~30 ms each time. Both runners must spawn git without forking the host:
	/// `posix_spawn` runs no `pthread_atfork` handlers, a fork always does.
	#[cfg(any(target_os = "macos", target_os = "linux"))]
	#[tokio::test]
	async fn runners_spawn_git_without_forking_the_host() {
		use std::sync::atomic::{AtomicUsize, Ordering};
		static FORKS: AtomicUsize = AtomicUsize::new(0);
		extern "C" fn count_fork() {
			FORKS.fetch_add(1, Ordering::SeqCst);
		}
		if pi_spawn::add_chdir().is_none() {
			// Static musl test binaries: no `dlsym`, so git forks by design.
			return;
		}
		// SAFETY: registers a handler that only bumps an atomic.
		assert_eq!(unsafe { libc::pthread_atfork(Some(count_fork), None, None) }, 0);
		let dir = tempfile::tempdir().expect("tempdir");
		let args = ["--version".to_owned()];
		let sync = run_sync(dir.path(), &args, SYNC_TIMEOUT).expect("sync runner");
		let spawned = run(dir.path(), &args, &RunOptions::default())
			.await
			.expect("async runner");
		for out in [sync, spawned] {
			assert_eq!(out.exit_code, 0, "git --version failed: {out:?}");
		}
		assert_eq!(FORKS.load(Ordering::SeqCst), 0, "a runner forked the host to start git");
	}

	/// Two guarantees this crate builds on top of, both of which depend on what
	/// the child process actually receives:
	///
	/// - The ownership fallback reads git's diagnostic, and `LC_ALL` outranks
	///   `LC_MESSAGES`, so an inherited one hands back a translated message that
	///   [`is_dubious_ownership`] cannot match.
	/// - The `:(literal)` magic this crate builds is only explicit once the
	///   global pathspec modes are gone; `GIT_LITERAL_PATHSPECS=1` would turn
	///   the prefix into filename text and match nothing.
	///
	/// Asserted through [`run_sync`] rather than [`apply_env`] directly, because
	/// the regression this covers was the synchronous builder not calling the
	/// helper. The variables have to be present before the process starts, and
	/// `set_var` in a running test binary is observable by every other thread,
	/// so the probe runs in a re-executed copy of this test binary spawned with
	/// them already in its environment.
	#[test]
	fn sync_runner_pins_message_locale_and_scrubs_pathspec_modes() {
		if let Some(repo) = std::env::var_os(ENV_PROBE_REPO) {
			let out = run_sync(
				Path::new(&repo),
				&["-c".to_owned(), format!("alias.envprobe={ENV_PROBE_ALIAS}"), "envprobe".to_owned()],
				SYNC_TIMEOUT,
			)
			.expect("run alias");

			assert_eq!(out.exit_code, 0, "alias failed: {out:?}");
			assert!(out.stdout.contains("LC_ALL=[]"), "LC_ALL leaked: {out:?}");
			assert!(out.stdout.contains("LC_MESSAGES=[C]"), "messages not pinned: {out:?}");
			// The character locale is preserved so paths keep round-tripping as
			// UTF-8; only the message locale is forced.
			assert!(
				out.stdout.contains("LC_CTYPE=[fr_FR.UTF-8]"),
				"UTF-8 character locale dropped: {out:?}"
			);
			assert!(out.stdout.contains("LITERAL=[]"), "literal pathspec mode leaked: {out:?}");
			assert!(out.stdout.contains("ICASE=[]"), "icase pathspec mode leaked: {out:?}");
			return;
		}

		let dir = tempfile::tempdir().expect("tempdir");
		let init = std::process::Command::new("git")
			.args(["init", "-q", "-b", "main"])
			.current_dir(dir.path())
			.status()
			.expect("spawn git init");
		assert!(init.success(), "git init failed");

		let name = format!(
			"{}::sync_runner_pins_message_locale_and_scrubs_pathspec_modes",
			module_path!()
				.split_once("::")
				.expect("crate-qualified module path")
				.1
		);
		let child = std::process::Command::new(std::env::current_exe().expect("test binary"))
			.args(["--exact", &name, "--nocapture", "--test-threads=1"])
			.env(ENV_PROBE_REPO, dir.path())
			.env("LC_ALL", "fr_FR.UTF-8")
			.env("GIT_LITERAL_PATHSPECS", "1")
			.env("GIT_ICASE_PATHSPECS", "1")
			.output()
			.expect("re-exec test binary");
		assert!(
			child.status.success(),
			"environment probe failed:\n{}{}",
			String::from_utf8_lossy(&child.stdout),
			String::from_utf8_lossy(&child.stderr)
		);
	}
}
