//! `posix_spawn` with session and process-group placement.
//!
//! Two layers:
//! - [`FileActions`], [`Attr`] and [`spawn_raw`]: RAII wrappers and the raw
//!   call, for callers that cache actions and attributes per thread (pi-shell).
//! - [`Command`]: an owned builder for one-shot spawns (pi-vcs).
//!
//! **Fallback.** Every entry reports "`posix_spawn` cannot express this on
//! this libc" as `Ok(None)` (or [`is_unsupported`] on a raw error), never as
//! a spawn failure: callers then take their fork path. That covers a libc
//! without `posix_spawn_file_actions_addchdir_np` (glibc < 2.29, musl <
//! 1.1.24, a static musl where `dlsym` finds nothing) and flags or calls the
//! libc rejects with `EINVAL`/`ENOSYS` (`POSIX_SPAWN_SETSID` before glibc 2.26
//! or musl 1.1.17). The `addchdir` gate alone already excludes both older
//! libcs; the error check covers the rest.

use std::{
	ffi::{CStr, CString, OsStr, OsString, c_char, c_int},
	io::{self, PipeReader, PipeWriter},
	mem::MaybeUninit,
	os::{
		fd::{AsRawFd, OwnedFd, RawFd},
		unix::{ffi::OsStrExt, process::ExitStatusExt},
	},
	path::Path,
	process::ExitStatus,
};

/// `posix_spawn_file_actions_addchdir_np`.
pub type AddChdir =
	unsafe extern "C" fn(*mut libc::posix_spawn_file_actions_t, *const c_char) -> c_int;

/// The libc's `posix_spawn_file_actions_addchdir_np`, if it has one.
#[cfg(target_os = "macos")]
#[allow(clippy::unnecessary_wraps, reason = "the libc extension is optional on Linux")]
#[must_use]
pub const fn add_chdir() -> Option<AddChdir> {
	Some(libc::posix_spawn_file_actions_addchdir_np)
}

/// The libc's `posix_spawn_file_actions_addchdir_np`, if it has one (glibc
/// 2.29+, musl 1.1.24+; resolved at run time so an older libc still loads).
#[cfg(target_os = "linux")]
#[must_use]
pub fn add_chdir() -> Option<AddChdir> {
	// A direct reference prevents loading on an older libc before the caller
	// can choose its fork fallback.
	static ADD_CHDIR: std::sync::LazyLock<Option<AddChdir>> = std::sync::LazyLock::new(|| {
		// SAFETY: RTLD_DEFAULT and this NUL-terminated symbol name are valid.
		let symbol = unsafe {
			libc::dlsym(libc::RTLD_DEFAULT, c"posix_spawn_file_actions_addchdir_np".as_ptr())
		};
		if symbol.is_null() {
			None
		} else {
			// SAFETY: the resolved libc function has the AddChdir signature
			// and remains available for the lifetime of the process.
			Some(unsafe { std::mem::transmute::<*mut libc::c_void, AddChdir>(symbol) })
		}
	});
	*ADD_CHDIR
}

/// `POSIX_SPAWN_SETSID` (`<sys/spawn.h>`, macOS 10.15+; absent from the libc
/// crate there).
#[cfg(target_os = "macos")]
pub const SETSID: c_int = 0x0400;
/// `POSIX_SPAWN_SETSID` (glibc 2.26+, musl 1.1.17+; same value on both).
#[cfg(target_os = "linux")]
pub const SETSID: c_int = 0x80;

/// Map a `posix_spawn*` return code (an errno value, not `-1`) to a result.
pub fn check(rc: c_int) -> io::Result<()> {
	if rc == 0 {
		Ok(())
	} else {
		Err(io::Error::from_raw_os_error(rc))
	}
}

/// Whether `err` from a `posix_spawn*` call means this libc cannot express
/// the request (unknown flag, missing support), so the caller must fork
/// instead of failing the spawn.
#[must_use]
pub fn is_unsupported(err: &io::Error) -> bool {
	matches!(err.raw_os_error(), Some(libc::EINVAL | libc::ENOSYS))
}

/// Turn a spawn outcome into the fallback contract: unsupported is `None`.
fn classify<T>(result: io::Result<T>) -> io::Result<Option<T>> {
	match result {
		Ok(v) => Ok(Some(v)),
		Err(e) if is_unsupported(&e) => Ok(None),
		Err(e) => Err(e),
	}
}

/// Where the child goes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Place {
	/// A new session it leads (`setsid`): no controlling terminal.
	Session,
	/// Process group `0` = a new group it leads, else that group.
	Group(libc::pid_t),
	/// The spawner's group and session.
	Inherit,
}

/// Initialized `posix_spawn_file_actions_t`, destroyed on drop.
pub struct FileActions(MaybeUninit<libc::posix_spawn_file_actions_t>);

impl FileActions {
	/// An empty action list.
	pub fn new() -> io::Result<Self> {
		let mut fa = MaybeUninit::uninit();
		// SAFETY: init writes the object; only an initialized one is wrapped
		// (and destroyed on drop).
		check(unsafe { libc::posix_spawn_file_actions_init(fa.as_mut_ptr()) })?;
		Ok(Self(fa))
	}

	/// The initialized object, for `posix_spawn`.
	pub const fn ptr(&mut self) -> *mut libc::posix_spawn_file_actions_t {
		self.0.as_mut_ptr()
	}

	/// Install `source` at `target` in the child.
	pub fn dup2(&mut self, source: RawFd, target: RawFd) -> io::Result<()> {
		// SAFETY: initialized actions; descriptors are plain integers.
		check(unsafe { libc::posix_spawn_file_actions_adddup2(self.ptr(), source, target) })
	}

	/// Close `target` in the child.
	pub fn close(&mut self, target: RawFd) -> io::Result<()> {
		// SAFETY: initialized actions; `target` is a plain integer.
		check(unsafe { libc::posix_spawn_file_actions_addclose(self.ptr(), target) })
	}

	/// Change the child's directory to `cwd` through `add_chdir`.
	pub fn chdir(&mut self, add_chdir: AddChdir, cwd: &CStr) -> io::Result<()> {
		// SAFETY: initialized actions; libc copies the NUL-terminated cwd.
		check(unsafe { add_chdir(self.ptr(), cwd.as_ptr()) })
	}
}

impl Drop for FileActions {
	fn drop(&mut self) {
		// SAFETY: initialized in `new`.
		unsafe { libc::posix_spawn_file_actions_destroy(self.0.as_mut_ptr()) };
	}
}

/// Initialized `posix_spawnattr_t`, destroyed on drop.
pub struct Attr(MaybeUninit<libc::posix_spawnattr_t>);

impl Attr {
	/// Attributes placing the child at `place` with signal mask `mask` and
	/// the signals in `defaults` reset to `SIG_DFL`. On macOS every
	/// descriptor not installed by the file actions is closed in the child
	/// (`POSIX_SPAWN_CLOEXEC_DEFAULT`).
	///
	/// An error for which [`is_unsupported`] holds means the libc rejected
	/// a flag (`POSIX_SPAWN_SETSID` on an old libc): fall back.
	pub fn new(place: Place, mask: &libc::sigset_t, defaults: &libc::sigset_t) -> io::Result<Self> {
		let mut a = MaybeUninit::uninit();
		// SAFETY: init writes the object; only an initialized one is wrapped
		// (and destroyed on drop).
		check(unsafe { libc::posix_spawnattr_init(a.as_mut_ptr()) })?;
		let mut attr = Self(a);
		let mut flags = libc::POSIX_SPAWN_SETSIGMASK | libc::POSIX_SPAWN_SETSIGDEF;
		match place {
			Place::Session => flags |= SETSID,
			Place::Group(pgid) => {
				flags |= libc::POSIX_SPAWN_SETPGROUP;
				// SAFETY: `attr` is initialized.
				check(unsafe { libc::posix_spawnattr_setpgroup(attr.ptr(), pgid) })?;
			},
			Place::Inherit => {},
		}
		#[cfg(target_os = "macos")]
		{
			flags |= libc::POSIX_SPAWN_CLOEXEC_DEFAULT;
		}
		// SAFETY: `attr` is initialized; both sets are valid for reads.
		unsafe {
			check(libc::posix_spawnattr_setflags(attr.ptr(), flags as libc::c_short))?;
			check(libc::posix_spawnattr_setsigmask(attr.ptr(), mask))?;
			check(libc::posix_spawnattr_setsigdefault(attr.ptr(), defaults))?;
		}
		Ok(attr)
	}

	/// The initialized object, for `posix_spawn`.
	pub const fn ptr(&mut self) -> *mut libc::posix_spawnattr_t {
		self.0.as_mut_ptr()
	}
}

impl Drop for Attr {
	fn drop(&mut self) {
		// SAFETY: initialized in `new`.
		unsafe { libc::posix_spawnattr_destroy(self.0.as_mut_ptr()) };
	}
}

/// How [`spawn_raw`] finds the program.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lookup {
	/// `path` is used as given (`posix_spawn`).
	Exact,
	/// `path` without a `/` is searched in the spawner's `PATH`
	/// (`posix_spawnp`, `execvp` semantics).
	Path,
}

/// `posix_spawn` (or `posix_spawnp`) one child; returns its pid.
///
/// # Safety
/// `path` must be NUL-terminated; `argv` and `envp` must be NULL-terminated
/// arrays of NUL-terminated strings, all valid for the call.
pub unsafe fn spawn_raw(
	path: *const c_char,
	lookup: Lookup,
	actions: &mut FileActions,
	attr: &mut Attr,
	argv: *const *mut c_char,
	envp: *const *mut c_char,
) -> io::Result<libc::pid_t> {
	let spawn = match lookup {
		Lookup::Exact => libc::posix_spawn,
		Lookup::Path => libc::posix_spawnp,
	};
	let mut pid: libc::pid_t = 0;
	// SAFETY: the caller guarantees the strings and arrays; actions and
	// attributes are initialized.
	check(unsafe { spawn(&raw mut pid, path, actions.ptr(), attr.ptr(), argv, envp) })?;
	Ok(pid)
}

/// An owned one-shot spawn: program, argv, full environment, cwd,
/// descriptors and placement.
///
/// Mirrors std's `Command` where it matters: a program without `/` is looked
/// up in `PATH` (when the child's `PATH` differs from the spawner's,
/// `posix_spawnp` would search the wrong one, so that case reports
/// unsupported), `SIGPIPE` is reset to its default, and only the installed
/// descriptors reach the child provided every other one is close-on-exec
/// (always true on macOS, where the rest are closed outright).
pub struct Command {
	program: CString,
	args:    Vec<CString>,
	env:     Option<Vec<(OsString, OsString)>>,
	cwd:     Option<CString>,
	fds:     Vec<(RawFd, RawFd)>,
	place:   Place,
	/// First interior NUL seen while building; reported at spawn like std.
	nul:     bool,
}

impl Command {
	/// A command running `program` with `argv[0] = program`, the spawner's
	/// environment and cwd, no descriptors installed, in the spawner's group.
	pub fn new(program: impl AsRef<OsStr>) -> Self {
		let mut nul = false;
		let program = cstring(program.as_ref(), &mut nul);
		Self {
			args: vec![program.clone()],
			program,
			env: None,
			cwd: None,
			fds: Vec::new(),
			place: Place::Inherit,
			nul,
		}
	}

	/// Append one argument.
	pub fn arg(&mut self, arg: impl AsRef<OsStr>) -> &mut Self {
		let arg = cstring(arg.as_ref(), &mut self.nul);
		self.args.push(arg);
		self
	}

	/// Append arguments.
	pub fn args<I: IntoIterator<Item = S>, S: AsRef<OsStr>>(&mut self, args: I) -> &mut Self {
		for arg in args {
			self.arg(arg);
		}
		self
	}

	/// Replace the child's whole environment with `vars`.
	pub fn env_exact(&mut self, vars: Vec<(OsString, OsString)>) -> &mut Self {
		self.env = Some(vars);
		self
	}

	/// The child's working directory.
	pub fn current_dir(&mut self, dir: impl AsRef<Path>) -> &mut Self {
		self.cwd = Some(cstring(dir.as_ref().as_os_str(), &mut self.nul));
		self
	}

	/// Install `source` (owned by the caller, open until `spawn` returns)
	/// at `target` in the child.
	pub fn fd(&mut self, source: RawFd, target: RawFd) -> &mut Self {
		self.fds.push((source, target));
		self
	}

	/// Where the child goes.
	pub const fn place(&mut self, place: Place) -> &mut Self {
		self.place = place;
		self
	}

	/// Spawn; `Ok(None)` when `posix_spawn` cannot express this command on
	/// this libc (fall back to forking), `Err` when the spawn itself failed
	/// (`NotFound` for a missing program or cwd, as std reports).
	pub fn spawn(&self) -> io::Result<Option<libc::pid_t>> {
		self.spawn_with(add_chdir())
	}

	fn spawn_with(&self, add_chdir: Option<AddChdir>) -> io::Result<Option<libc::pid_t>> {
		if self.nul {
			return Err(io::Error::new(
				io::ErrorKind::InvalidInput,
				"nul byte found in provided data",
			));
		}
		// `posix_spawnp` even for a path with `/`: it then skips the PATH
		// search but keeps `execvp`'s `/bin/sh` retry for a file without
		// `#!` (macOS; std's fork path had it through `execvp`), which plain
		// `posix_spawn` fails with `ENOEXEC`.
		let searches_path = !self.program.as_bytes().contains(&b'/');
		let env = if let Some(vars) = &self.env {
			if searches_path
				&& vars
					.iter()
					.find(|(k, _)| k == "PATH")
					.map(|(_, v)| v.as_os_str())
					!= std::env::var_os("PATH").as_deref()
			{
				return Ok(None);
			}
			env_block(vars.iter().map(|(k, v)| (k.as_os_str(), v.as_os_str())))?
		} else {
			let vars: Vec<_> = std::env::vars_os().collect();
			env_block(vars.iter().map(|(k, v)| (k.as_os_str(), v.as_os_str())))?
		};
		let mut actions = FileActions::new()?;
		for &(source, target) in &self.fds {
			actions.dup2(source, target)?;
		}
		if let Some(cwd) = &self.cwd {
			let Some(add_chdir) = add_chdir else {
				return Ok(None);
			};
			actions.chdir(add_chdir, cwd)?;
		}
		// SAFETY: sigset_t is plain data, initialized by sigemptyset below.
		let mut mask: libc::sigset_t = unsafe { std::mem::zeroed() };
		// SAFETY: as above.
		let mut defaults: libc::sigset_t = unsafe { std::mem::zeroed() };
		// SAFETY: both sets are valid, writable sigset_t values.
		unsafe {
			libc::sigemptyset(&raw mut mask);
			libc::sigemptyset(&raw mut defaults);
			libc::sigaddset(&raw mut defaults, libc::SIGPIPE);
		}
		let Some(mut attr) = classify(Attr::new(self.place, &mask, &defaults))? else {
			return Ok(None);
		};
		let mut argv: Vec<*mut c_char> = self.args.iter().map(|a| a.as_ptr().cast_mut()).collect();
		argv.push(std::ptr::null_mut());
		let mut envp: Vec<*mut c_char> = env.iter().map(|e| e.as_ptr().cast_mut()).collect();
		envp.push(std::ptr::null_mut());
		// SAFETY: every string is a live CString owned by `self` or `env`;
		// both arrays end in NULL.
		classify(unsafe {
			spawn_raw(
				self.program.as_ptr(),
				Lookup::Path,
				&mut actions,
				&mut attr,
				argv.as_ptr(),
				envp.as_ptr(),
			)
		})
	}
}

fn cstring(s: &OsStr, nul: &mut bool) -> CString {
	CString::new(s.as_bytes()).unwrap_or_else(|_| {
		*nul = true;
		CString::default()
	})
}

fn env_block<'a>(vars: impl Iterator<Item = (&'a OsStr, &'a OsStr)>) -> io::Result<Vec<CString>> {
	vars
		.map(|(k, v)| {
			let mut entry = Vec::with_capacity(k.len() + v.len() + 1);
			entry.extend_from_slice(k.as_bytes());
			entry.push(b'=');
			entry.extend_from_slice(v.as_bytes());
			CString::new(entry).map_err(|_| {
				io::Error::new(io::ErrorKind::InvalidInput, "nul byte found in provided data")
			})
		})
		.collect()
}

/// What the child's stdin is.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stdin {
	/// `/dev/null`.
	Null,
	/// A pipe the parent writes through [`Child::stdin`].
	Piped,
}

/// A child started by [`Command::spawn_child`], with its stdout and stderr
/// piped to the parent.
///
/// The parent owns reaping: dropping a child that was never waited for kills
/// it (`SIGKILL`) and reaps it, so a dropped child never lingers as a zombie or
/// outlives a cancelled caller.
pub struct Child {
	pid:        libc::pid_t,
	status:     Option<ExitStatus>,
	/// Write end of the child's stdin, when [`Stdin::Piped`].
	pub stdin:  Option<PipeWriter>,
	/// Read end of the child's stdout.
	pub stdout: Option<PipeReader>,
	/// Read end of the child's stderr.
	pub stderr: Option<PipeReader>,
}

impl Child {
	/// The child's pid.
	#[must_use]
	pub const fn id(&self) -> libc::pid_t {
		self.pid
	}

	/// Send `signal` unless the child was already reaped.
	pub fn signal(&self, signal: c_int) -> io::Result<()> {
		if self.status.is_some() {
			return Ok(());
		}
		// SAFETY: kill(2) on our own unreaped child: the pid cannot have been
		// reused while it is unreaped.
		if unsafe { libc::kill(self.pid, signal) } == 0 {
			Ok(())
		} else {
			Err(io::Error::last_os_error())
		}
	}

	/// `SIGKILL`.
	pub fn kill(&self) -> io::Result<()> {
		self.signal(libc::SIGKILL)
	}

	/// Reap the child if it has exited.
	pub fn try_wait(&mut self) -> io::Result<Option<ExitStatus>> {
		self.reap(libc::WNOHANG)
	}

	/// Block until the child exits and reap it.
	pub fn wait(&mut self) -> io::Result<ExitStatus> {
		Ok(self.reap(0)?.expect("a blocking waitpid returns a status"))
	}

	fn reap(&mut self, flags: c_int) -> io::Result<Option<ExitStatus>> {
		if let Some(status) = self.status {
			return Ok(Some(status));
		}
		let status = waitpid(self.pid, flags)?;
		self.status = status;
		Ok(status)
	}
}

impl Drop for Child {
	fn drop(&mut self) {
		if self.status.is_none() {
			let _ = self.kill();
			let _ = self.wait();
		}
	}
}

/// `waitpid(pid, flags)`, retried on `EINTR`; `None` for a `WNOHANG` poll of a
/// child still running.
fn waitpid(pid: libc::pid_t, flags: c_int) -> io::Result<Option<ExitStatus>> {
	let mut status = 0;
	loop {
		// SAFETY: waits for our own child; `status` is a valid out pointer.
		match unsafe { libc::waitpid(pid, &raw mut status, flags) } {
			0 => return Ok(None),
			-1 => {
				let err = io::Error::last_os_error();
				if err.kind() != io::ErrorKind::Interrupted {
					return Err(err);
				}
			},
			_ => return Ok(Some(ExitStatus::from_raw(status))),
		}
	}
}

impl Command {
	/// Spawn with stdout and stderr piped and stdin per `stdin`.
	///
	/// Takes `posix_spawn` when this libc can express the command, else
	/// falls back to std's fork-based spawn with the same placement, so the
	/// caller always gets a child or a real spawn error.
	pub fn spawn_child(&self, stdin: Stdin) -> io::Result<Child> {
		let (stdin_child, stdin_parent) = match stdin {
			Stdin::Null => (OwnedFd::from(std::fs::File::open("/dev/null")?), None),
			Stdin::Piped => {
				let (reader, writer) = std::io::pipe()?;
				(OwnedFd::from(reader), Some(writer))
			},
		};
		let (stdout, stdout_child) = std::io::pipe()?;
		let (stderr, stderr_child) = std::io::pipe()?;
		let mut posix = Self {
			program: self.program.clone(),
			args:    self.args.clone(),
			env:     self.env.clone(),
			cwd:     self.cwd.clone(),
			fds:     self.fds.clone(),
			place:   self.place,
			nul:     self.nul,
		};
		posix
			.fd(stdin_child.as_raw_fd(), 0)
			.fd(stdout_child.as_raw_fd(), 1)
			.fd(stderr_child.as_raw_fd(), 2);
		let pid = match posix.spawn()? {
			Some(pid) => pid,
			None => self.fork_spawn(stdin_child, stdout_child.into(), stderr_child.into())?,
		};
		Ok(Child {
			pid,
			status: None,
			stdin: stdin_parent,
			stdout: Some(stdout),
			stderr: Some(stderr),
		})
	}

	/// std's spawn for what `posix_spawn` cannot express here. std forks
	/// whenever it must `setsid` off glibc; this is only the fallback.
	fn fork_spawn(
		&self,
		stdin: OwnedFd,
		stdout: OwnedFd,
		stderr: OwnedFd,
	) -> io::Result<libc::pid_t> {
		use std::os::unix::process::CommandExt;
		if !self.fds.is_empty() {
			return Err(io::Error::new(
				io::ErrorKind::Unsupported,
				"extra descriptors need posix_spawn on this libc",
			));
		}
		let mut cmd = std::process::Command::new(OsStr::from_bytes(self.program.as_bytes()));
		cmd.args(
			self.args[1..]
				.iter()
				.map(|a| OsStr::from_bytes(a.as_bytes())),
		)
		.stdin(stdin)
		.stdout(stdout)
		.stderr(stderr);
		if let Some(vars) = &self.env {
			cmd.env_clear().envs(vars.iter().map(|(k, v)| (k, v)));
		}
		if let Some(cwd) = &self.cwd {
			cmd.current_dir(OsStr::from_bytes(cwd.as_bytes()));
		}
		match self.place {
			Place::Session => {
				cmd.setsid(true);
			},
			Place::Group(pgid) => {
				cmd.process_group(pgid);
			},
			Place::Inherit => {},
		}
		let child = cmd.spawn()?;
		// The std handle is dropped unreaped; [`Child`] reaps the pid.
		Ok(child.id().cast_signed())
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn reap(pid: libc::pid_t) -> c_int {
		let mut status = 0;
		// SAFETY: waits for our own child.
		assert_eq!(unsafe { libc::waitpid(pid, &raw mut status, 0) }, pid);
		status
	}

	#[test]
	fn unsupported_errors_signal_fallback_not_failure() {
		for errno in [libc::EINVAL, libc::ENOSYS] {
			assert!(matches!(classify::<i32>(Err(io::Error::from_raw_os_error(errno))), Ok(None)));
		}
		let real = classify::<i32>(Err(io::Error::from_raw_os_error(libc::ENOENT)));
		assert_eq!(real.expect_err("real failure").kind(), io::ErrorKind::NotFound);
		assert!(matches!(classify(Ok(7)), Ok(Some(7))));
	}

	#[test]
	fn missing_addchdir_signals_fallback() {
		let mut cmd = Command::new("true");
		cmd.current_dir("/");
		assert!(matches!(cmd.spawn_with(None), Ok(None)));
	}

	#[test]
	fn changed_path_for_a_path_lookup_signals_fallback() {
		let mut cmd = Command::new("true");
		cmd.env_exact(vec![("PATH".into(), "/nonexistent-pi-spawn".into())]);
		assert!(matches!(cmd.spawn(), Ok(None)));
	}

	/// A commit hook without `#!` ran through `/bin/sh` under std's fork path
	/// (`execvp`); the spawn must keep that on macOS.
	#[cfg(target_os = "macos")]
	#[test]
	fn script_without_shebang_runs_through_sh() {
		use std::os::unix::fs::PermissionsExt;
		let script = std::env::temp_dir().join(format!("pi-spawn-noshebang-{}", std::process::id()));
		std::fs::write(&script, "exit 7\n").expect("write script");
		std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).expect("chmod");
		let mut child = Command::new(&script)
			.spawn_child(Stdin::Null)
			.expect("spawn script");
		let code = child.wait().expect("wait").code();
		let _ = std::fs::remove_file(&script);
		assert_eq!(code, Some(7));
	}

	#[test]
	fn missing_program_is_not_found() {
		let err = Command::new("/nonexistent/pi-spawn-program")
			.spawn()
			.expect_err("spawn of a missing program");
		assert_eq!(err.kind(), io::ErrorKind::NotFound);
	}

	#[test]
	fn session_child_leads_its_own_session() {
		let mut cmd = Command::new("sleep");
		cmd.arg("5").place(Place::Session);
		let pid = cmd.spawn().expect("spawn").expect("posix_spawn supported");
		// SAFETY: plain syscalls on our own unreaped child.
		let (sid, host) = unsafe { (libc::getsid(pid), libc::getsid(0)) };
		// SAFETY: as above.
		unsafe { libc::kill(pid, libc::SIGKILL) };
		reap(pid);
		assert_eq!(sid, pid, "child does not lead a session");
		assert_ne!(sid, host);
	}

	#[test]
	fn installs_descriptors_and_environment() {
		if add_chdir().is_none() {
			// Static musl: no `dlsym`, so a cwd always falls back to forking.
			return;
		}
		let (reader, writer) = std::io::pipe().expect("pipe");
		let mut cmd = Command::new("/bin/sh");
		let dir = std::env::temp_dir().canonicalize().expect("temp dir");
		cmd.args(["-c", "printf '%s %s' \"$PI_SPAWN_PROBE\" \"$(pwd -P)\""])
			.current_dir(&dir)
			.env_exact(vec![("PI_SPAWN_PROBE".into(), "hello".into())])
			.fd(std::os::fd::AsRawFd::as_raw_fd(&writer), 1);
		let pid = cmd.spawn().expect("spawn").expect("posix_spawn supported");
		drop(writer);
		let mut out = String::new();
		std::io::Read::read_to_string(&mut &reader, &mut out).expect("read");
		assert_eq!(reap(pid), 0);
		assert_eq!(out, format!("hello {}", dir.display()));
	}
}
