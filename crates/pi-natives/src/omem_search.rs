//! Regex scan over omem chat messages.
//!
//! Runs in Rust so the `regex` crate's linear-time matching bounds every
//! query; JSC silently abandons heavy backtracking and reports "no match".

use napi::bindgen_prelude::{Error, Result, Uint32Array};
use napi_derive::napi;
use regex::RegexBuilder;

/// Case-insensitive regex search over `texts`.
///
/// Returns flat `[index, utf16Offset, ...]` pairs, one per matching text, in
/// input order; the offset is the first match start in UTF-16 code units so
/// JS can `slice` around it.
#[napi(js_name = "regexSearchTexts")]
pub fn regex_search_texts(pattern: String, texts: Vec<String>) -> Result<Uint32Array> {
	let re = RegexBuilder::new(&pattern)
		.case_insensitive(true)
		.build()
		.map_err(|e| Error::from_reason(e.to_string()))?;
	let mut out = Vec::new();
	for (i, text) in texts.iter().enumerate() {
		if let Some(m) = re.find(text) {
			let at = text[..m.start()].encode_utf16().count();
			out.push(i as u32);
			out.push(at as u32);
		}
	}
	Ok(Uint32Array::new(out))
}
