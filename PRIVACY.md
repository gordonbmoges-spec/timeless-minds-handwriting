# Privacy Notes

This repository does not include analytics, advertising SDKs, user accounts, or a cloud conversation database.

When a visitor submits handwriting, the browser sends a cropped PNG, the selected persona ID, a bounded local conversation history, optional reply preferences and optional long-term memory to the same-origin backend. For a custom book, its bounded identity and personality fields are also included. If AI mode is enabled, the backend forwards the necessary request to the model provider configured by the visitor or operator.

Conversation history, custom books, reply preferences and long-term memory are stored in the visitor's browser. A browser-provided API key is held only in page memory. Clearing site data removes those local records; refreshing or closing the page clears the API key.

Model providers and hosting operators may process network metadata and request content under their own terms. Public deployments should publish an operator-specific privacy notice before collecting real handwriting or enabling a server-owned model key.
