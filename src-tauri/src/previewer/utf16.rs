use serde::{Deserialize, Serialize};
use std::ops::Range;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Utf16Index(usize);
impl Utf16Index {
    pub fn from_utf8_index(target_utf8: usize, text: &str) -> Option<Self> {
        if target_utf8 == 0 {
            return Some(Self(0));
        }
        if target_utf8 == text.len() {
            return Some(Self(text.chars().map(|ch| ch.len_utf16()).sum()));
        }

        let mut current_utf16 = 0;
        for (byte_offset, ch) in text.char_indices() {
            if byte_offset == target_utf8 {
                return Some(Self(current_utf16));
            }
            current_utf16 += ch.len_utf16();
        }

        None
    }
    pub fn to_utf8_index(&self, text: &str) -> Option<usize> {
        let mut current_utf16 = 0;

        for (byte_offset, ch) in text.char_indices() {
            if current_utf16 == self.0 {
                return Some(byte_offset);
            }
            current_utf16 += ch.len_utf16();
        }

        if current_utf16 == self.0 {
            Some(text.len())
        } else {
            None
        }
    }
}

pub fn to_utf8_range(text: &str, range: &Range<Utf16Index>) -> Option<Range<usize>> {
    Some(range.start.to_utf8_index(text)?..range.end.to_utf8_index(text)?)
}
pub fn to_utf16_range(text: &str, range: &Range<usize>) -> Option<Range<Utf16Index>> {
    Some(
        Utf16Index::from_utf8_index(range.start, text)?
            ..Utf16Index::from_utf8_index(range.end, text)?,
    )
}
