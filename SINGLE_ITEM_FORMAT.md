# 单物品单JSON格式说明

## 概述

JEI-web 数据包现在支持两种物品数据格式：

1. **数组格式（原有格式）**：所有物品定义在一个 `items.json` 文件中
2. **单文件格式（新格式）**：每个物品定义在独立的 JSON 文件中

## 单文件格式使用方法

### 目录结构

```
pack-name/
├── manifest.json
├── itemsIndex.json       # 物品索引文件
├── items/                # 物品目录
│   ├── item1.json
│   ├── item2.json
│   └── item3.json
├── recipes.json
├── recipeTypes.json
└── tags.json
```

### manifest.json 配置

```json
{
  "packId": "your-pack-id",
  "gameId": "your-game",
  "displayName": "Your Pack Name",
  "version": "1.0.0",
  "files": {
    "items": "items/", // 注意末尾的斜杠表示是目录
    "itemsIndex": "itemsIndex.json", // 物品索引文件（必需）
    "tags": "tags.json",
    "recipeTypes": "recipeTypes.json",
    "recipes": "recipes.json"
  }
}
```

### itemsIndex.json 索引文件

`itemsIndex.json` 是一个数组，包含所有物品文件的相对路径：

```json
["items/iron_ore.json", "items/iron_ingot.json", "items/iron_pickaxe.json"]
```

### 物品文件格式

每个物品文件包含单个物品的完整定义：

```json
{
  "key": { "id": "demo.base.iron_ore" },
  "name": "Iron Ore",
  "tags": ["ore", "worldgen"],
  "iconSprite": {
    "url": "/packs/demo/icons.webp",
    "position": "0px 0px",
    "size": 64,
    "color": "#8B7355"
  }
}
```

## 两种格式的对比

### 数组格式（原有）

**优点：**

- 所有物品在一个文件中，易于管理
- 文件数量少
- 适合小型数据包

**缺点：**

- 单个文件可能变得很大
- 难以进行版本控制和协作
- 加载整个文件才能使用任何一个物品

### 单文件格式（新）

**优点：**

- 每个物品独立管理，易于版本控制
- 可以按需加载（未来可扩展）
- 便于协作开发
- 更容易进行增量更新

**缺点：**

- 文件数量多
- 需要维护索引文件

## 何时使用单文件格式

推荐在以下情况下使用单文件格式：

1. **大型数据包**：物品数量超过 100 个
2. **团队协作**：多人同时编辑不同的物品
3. **版本控制**：需要清晰的 Git 历史
4. **动态内容**：物品会频繁更新或增删
5. **模块化设计**：希望按类别组织物品文件

## 示例

查看 `public/packs/single-item-demo/` 目录了解完整示例：

```
public/packs/single-item-demo/
├── manifest.json
├── itemsIndex.json
├── items/
│   ├── iron_ore.json
│   ├── iron_ingot.json
│   ├── iron_dust.json
│   ├── stick.json
│   ├── iron_pickaxe.json
│   └── magic_pickaxe.json
├── recipes.json
├── recipeTypes.json
└── tags.json
```

## 兼容性

- 两种格式完全兼容，可以同时使用
- 编辑器和在线加载器都支持两种格式
- 导出的 ZIP 包也支持两种格式

## 最佳实践

1. **命名规范**：使用物品 ID 作为文件名，如 `iron_ore.json` 对应物品 ID `demo.base.iron_ore`
2. **文件组织**：可以在 `items/` 目录下创建子目录按类别组织物品
   ```
   items/
   ├── ores/
   │   ├── iron_ore.json
   │   └── gold_ore.json
   ├── tools/
   │   └── pickaxe.json
   └── materials/
       └── stick.json
   ```
3. **索引顺序**：索引文件中的顺序会影响物品显示顺序，建议按逻辑顺序排列
4. **验证**：确保索引文件中的所有路径都存在，且每个物品文件都是有效的 JSON
