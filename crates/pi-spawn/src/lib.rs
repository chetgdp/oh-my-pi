//! Spawning and waiting for children without forking the host.
//!
//! Rust std only takes `posix_spawn` for a `setsid` command on glibc; on
//! macOS and musl it forks. A fork in a multi-threaded host is expensive on
//! macOS: xzone malloc holds every other thread until the child execs
//! (`_xzm_fork_lock_wait`), which stalls a JS event loop for tens of
//! milliseconds per spawn. `posix_spawn` never runs `pthread_atfork`
//! handlers and does not take that lock.
//!
//! - [`posix`] (macOS, Linux): `posix_spawn` with session and process-group
//!   placement, and a [`Child`] with piped stdio.
//! - [`wait`] (every Unix): block until a child exits without reaping it.
#![cfg(unix)]
#![cfg_attr(any(target_os = "macos", target_os = "linux"), feature(process_setsid))]

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub mod posix;
pub mod wait;

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub use posix::*;
pub use wait::*;
