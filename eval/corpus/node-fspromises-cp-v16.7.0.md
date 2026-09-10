# Node.js v16.7.0 — fsPromises.cp

`fsPromises.cp(src, dest[, options])` was added in v16.7.0.

> Stability: 1 - Experimental

It asynchronously copies the entire directory structure from `src` to `dest`, including subdirectories and files.

Selected options:

- `force`: overwrite an existing file or directory; default `true`.
- `recursive`: copy directories recursively; default `false`.
- `filter`: may return a boolean or a `Promise<boolean>`.
