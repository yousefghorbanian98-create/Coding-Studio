use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio_util::sync::CancellationToken;

/// Tracks in-flight streams so they can be cancelled by id.
#[derive(Debug, Clone, Default)]
pub struct StreamRegistry {
    inner: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers a stream, replacing (and cancelling) any duplicate id.
    pub fn register(&self, stream_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        let mut guard = self.lock();
        if let Some(previous) = guard.insert(stream_id.to_string(), token.clone()) {
            previous.cancel();
        }
        token
    }

    /// Cancels a stream. Returns false when the id is unknown.
    pub fn cancel(&self, stream_id: &str) -> bool {
        let token = self.lock().remove(stream_id);
        match token {
            Some(token) => {
                token.cancel();
                true
            }
            None => false,
        }
    }

    /// Removes a finished stream without cancelling it.
    pub fn finish(&self, stream_id: &str) {
        self.lock().remove(stream_id);
    }

    pub fn active_count(&self) -> usize {
        self.lock().len()
    }

    pub fn cancel_all(&self) {
        let mut guard = self.lock();
        for (_, token) in guard.drain() {
            token.cancel();
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, CancellationToken>> {
        // A poisoned lock must not take the app down; recover the guard.
        self.inner.lock().unwrap_or_else(|error| error.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registers_and_cancels_a_stream() {
        let registry = StreamRegistry::new();
        let token = registry.register("a");
        assert!(!token.is_cancelled());
        assert_eq!(registry.active_count(), 1);

        assert!(registry.cancel("a"));
        assert!(token.is_cancelled());
        assert_eq!(registry.active_count(), 0);
    }

    #[test]
    fn cancelling_an_unknown_stream_is_reported() {
        let registry = StreamRegistry::new();
        assert!(!registry.cancel("missing"));
    }

    #[test]
    fn re_registering_cancels_the_previous_token() {
        let registry = StreamRegistry::new();
        let first = registry.register("a");
        let second = registry.register("a");
        assert!(first.is_cancelled());
        assert!(!second.is_cancelled());
        assert_eq!(registry.active_count(), 1);
    }

    #[test]
    fn finish_removes_without_cancelling() {
        let registry = StreamRegistry::new();
        let token = registry.register("a");
        registry.finish("a");
        assert!(!token.is_cancelled());
        assert_eq!(registry.active_count(), 0);
    }

    #[test]
    fn cancel_all_clears_every_stream() {
        let registry = StreamRegistry::new();
        let a = registry.register("a");
        let b = registry.register("b");
        registry.cancel_all();
        assert!(a.is_cancelled());
        assert!(b.is_cancelled());
        assert_eq!(registry.active_count(), 0);
    }
}
