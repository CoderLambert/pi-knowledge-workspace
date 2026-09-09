# Node.js v22.3.0 — fsPromises.cp

The change history for `fsPromises.cp(src, dest[, options])` records that in v22.3.0 this API is no longer experimental.

It asynchronously copies the entire directory structure from `src` to `dest`, including subdirectories and files.

Selected options include:

- `mode`: modifiers for the copy operation; default `0`.
- `recursive`: copy directories recursively; default `false`.
- `verbatimSymlinks`: skip path resolution for symlinks when `true`; default `false`.
