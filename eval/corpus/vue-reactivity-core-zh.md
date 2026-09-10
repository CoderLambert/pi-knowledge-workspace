# Vue 3 响应式 API：ref()

`ref()` 接受一个内部值，返回一个响应式且可更改的 ref 对象。这个对象通过 `.value` 指向内部值。

```ts
function ref<T>(value: T): Ref<UnwrapRef<T>>

interface Ref<T> {
  value: T
}
```

ref 的 `.value` 读操作会被追踪，写操作会触发相关副作用。若把对象赋给 ref，该对象会通过 `reactive()` 进行深层响应式转换；若不希望深层转换，可使用 `shallowRef()`。
