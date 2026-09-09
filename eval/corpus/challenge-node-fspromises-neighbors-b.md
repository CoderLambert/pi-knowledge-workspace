# Node.js v22.3.0 fs/promises 邻近 API（challenge B）

## fsPromises.readdir
`fsPromises.readdir()` 读取目录内容。根据选项，它可以返回名称字符串或目录项对象；递归读取属于该 API 自己的目录枚举语义。

## fsPromises.readFile
`fsPromises.readFile()` 异步读取文件的完整内容。传入编码时返回字符串，否则通常返回 Buffer；它面向文件内容读取而不是目录遍历。

## fsPromises.readlink
`fsPromises.readlink()` 读取符号链接中保存的目标文本。返回值可按编码设置转换，但不会把链接目标当作普通文件内容读取。

## fsPromises.realpath
`fsPromises.realpath()` 解析路径中的符号链接和相对组件，得到规范化后的真实路径。结果代表解析后的路径身份。

## fsPromises.rename
`fsPromises.rename()` 将路径从旧名称移动到新名称。具体覆盖与跨文件系统行为受底层平台文件系统语义约束。

## fsPromises.rm
`fsPromises.rm()` 删除文件或目录。目录删除可以使用 `recursive`，并可结合 `force` 处理某些不存在路径或错误场景；这些选项属于删除操作。

## fsPromises.stat
`fsPromises.stat()` 返回目标文件或目录的状态信息。默认会跟随符号链接，因此它与 `lstat()` 在链接路径上的语义不同。

## fsPromises.symlink
`fsPromises.symlink()` 创建指向目标的符号链接。Windows 上的 type 参数会影响创建的链接类型，其他平台通常不需要该提示。

## fsPromises.truncate
`fsPromises.truncate()` 将文件长度调整到指定大小。缩短会丢弃尾部数据，扩大时新增区域由文件系统按其规则提供。

## fsPromises.writeFile
`fsPromises.writeFile()` 将数据写入文件并返回 Promise。选项控制编码、打开标志以及相关写入行为；并发对同一文件多次写入需要由调用方协调。
