# Vue 3 响应式 API 邻近主题（challenge）

## computed getter
`computed()` 根据 getter 派生一个响应式计算结果。读取计算结果使用 `.value`，getter 的依赖变化后结果会按计算属性规则重新求值。

## computed writable
可写计算属性通过 `get` 与 `set` 组合定义。写入计算结果时会调用 `set`，而不是直接修改原始依赖对象。

## reactive proxy
`reactive()` 接收对象并返回代理。代理用于追踪属性访问和变更；调用方应优先持有代理，而不是长期混用原始对象。

## reactive collections
数组、Map 和 Set 等集合可以进入响应式系统。集合中的读取和写入会通过代理行为参与依赖追踪。

## readonly proxy
`readonly()` 为对象创建只读代理。读取仍可参与响应式链路，但尝试通过只读代理写入会被阻止并产生开发期警告。

## watchEffect execution
`watchEffect()` 会立即执行副作用函数，并自动追踪同步执行期间访问到的响应式依赖。依赖变化后副作用会再次运行。

## watchEffect cleanup
副作用可以注册清理逻辑，用于在下一次执行或停止观察前取消过期工作，例如请求、计时器或其他异步副作用。

## watch source
`watch()` 可以观察 getter、响应式对象或多个来源。回调接收新旧值，并且可以通过选项控制是否立即执行。

## watch flush timing
观察器可以选择不同的 flush 时机，以控制回调相对于组件更新的调度顺序。同步模式会更早触发，应避免对频繁变更的数据滥用。

## watch deep mode
观察对象时可以使用深层观察语义，让嵌套属性变化触发回调。深层遍历会增加成本，因此应根据数据规模谨慎使用。

## readonly nesting
只读转换会沿对象结构向下应用，适合暴露不应由消费者修改的状态视图。需要局部可写状态时应在状态所有者内部完成更新。

## computed debugging
计算属性和响应式副作用可以通过调试钩子观察依赖追踪与触发事件。这类钩子用于开发诊断，不应改变业务数据流。
