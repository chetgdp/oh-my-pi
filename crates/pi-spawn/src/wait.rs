//! Waiting for a child's exit without reaping it.

use std::{io, thread, time::Duration};

/// How a child ended.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Exit {
	/// It exited with this status.
	Exited(i32),
	/// A signal with this number killed it.
	Signaled(i32),
}

/// A stop or continue reported while waiting for the exit.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Event {
	/// Stopped by the signal with this number.
	Stopped(i32),
	/// Continued.
	Continued,
}

/// Block until `pid` exits and return how, leaving it unreaped (`WNOWAIT`).
///
/// The pid stays the caller's until it reaps, so signals sent meanwhile can
/// never reach a reused pid. Every stop and continue on the way goes to
/// `on_event`. `None` when the exit cannot be observed (`ECHILD`: someone
/// else reaped it, e.g. `SIGCHLD` set to `SIG_IGN` in the host).
///
/// Stops and continues are waited for too (`WSTOPPED | WCONTINUED`; macOS
/// `waitid(WEXITED)` reports stops anyway, measured: `si_status` 17 after
/// `SIGSTOP`). With `WNOWAIT` such a report would repeat, so it is consumed
/// with a non-reaping `waitid(WSTOPPED | WCONTINUED | WNOHANG)` (the event
/// reported is the one consumed) and the wait goes on.
pub fn wait_exit(pid: libc::pid_t, mut on_event: impl FnMut(Event)) -> Option<Exit> {
	loop {
		// SAFETY: siginfo_t is plain data, valid zeroed.
		let mut info: libc::siginfo_t = unsafe { std::mem::zeroed() };
		// SAFETY: `info` is writable; WNOWAIT leaves the child waitable.
		let rc = unsafe {
			libc::waitid(
				libc::P_PID,
				pid as libc::id_t,
				&raw mut info,
				libc::WEXITED | libc::WSTOPPED | libc::WCONTINUED | libc::WNOWAIT,
			)
		};
		if rc == 0 {
			// SAFETY: waitid filled `info` for a CLD_* event.
			let status = unsafe { info.si_status() };
			match info.si_code {
				libc::CLD_EXITED => return Some(Exit::Exited(status)),
				libc::CLD_KILLED | libc::CLD_DUMPED => return Some(Exit::Signaled(status)),
				_ => {
					// SAFETY: as above; without WEXITED this never reaps.
					let mut seen: libc::siginfo_t = unsafe { std::mem::zeroed() };
					// SAFETY: `seen` is writable.
					let rc = unsafe {
						libc::waitid(
							libc::P_PID,
							pid as libc::id_t,
							&raw mut seen,
							libc::WSTOPPED | libc::WCONTINUED | libc::WNOHANG,
						)
					};
					// SAFETY: `seen` was zeroed and possibly filled by waitid.
					if rc != 0 || unsafe { seen.si_pid() } == 0 {
						// Nothing consumed: do not spin on a report that stays.
						thread::sleep(Duration::from_millis(10));
						continue;
					}
					// SAFETY: waitid filled `seen` for a CLD_* event.
					let sig = unsafe { seen.si_status() };
					match seen.si_code {
						libc::CLD_STOPPED => on_event(Event::Stopped(sig)),
						libc::CLD_CONTINUED => on_event(Event::Continued),
						_ => {},
					}
					continue;
				},
			}
		}
		if io::Error::last_os_error().kind() != io::ErrorKind::Interrupted {
			return None;
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_stop_is_not_an_exit() {
		let mut child = std::process::Command::new("sleep")
			.arg("30")
			.spawn()
			.expect("spawn sleep");
		let pid = child.id().cast_signed();
		// SAFETY: signals our own unreaped child.
		unsafe { libc::kill(pid, libc::SIGSTOP) };
		let waiter = thread::spawn(move || {
			let mut events = Vec::new();
			let exit = wait_exit(pid, |e| events.push(e));
			(exit, events)
		});
		thread::sleep(Duration::from_millis(200));
		assert!(!waiter.is_finished(), "the wait returned on a stop");
		// SAFETY: as above.
		unsafe { libc::kill(pid, libc::SIGKILL) };
		let (exit, events) = waiter.join().expect("waiter");
		assert_eq!(exit, Some(Exit::Signaled(libc::SIGKILL)));
		assert!(events.contains(&Event::Stopped(libc::SIGSTOP)), "{events:?}");
		assert!(child.try_wait().expect("reap").is_some(), "the waiter must not reap");
	}
}
