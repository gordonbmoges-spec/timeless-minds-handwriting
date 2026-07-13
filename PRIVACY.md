# Privacy Notes

This repository does not include analytics, advertising SDKs, user accounts, or a cloud conversation database.

When a visitor submits handwriting, the browser sends a cropped PNG, the selected persona ID, a bounded local conversation history, and an optional reply preference to the same-origin backend. If AI mode is enabled, the backend forwards the necessary request to the model provider configured by the visitor or operator.

Conversation history and reply preferences are stored in the visitor's browser. A browser-provided API key is held only in page memory. Clearing site data removes local history and preferences; refreshing or closing the page clears the API key.

Model providers and hosting operators may process network metadata and request content under their own terms. Public deployments should publish an operator-specific privacy notice before collecting real handwriting or enabling a server-owned model key.
