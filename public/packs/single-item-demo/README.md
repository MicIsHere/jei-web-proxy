# 单物品单JSON文件格式说明

## 概述

此数据包演示了如何使用**单物品单JSON文件**的格式，在这种格式下，每个物品都有自己的JSON文件，包含该物品的完整信息，包括：

- 物品基本信息
- 相关的配方
- Wiki 文档信息

## 目录结构

```
single-item-demo/
├── manifest.json           # 数据包清单
├── items/                  # 物品目录
│   ├── iron_ore.json      # 物品文件
│   ├── iron_ingot.json
│   ├── iron_pickaxe.json
│   ├── diamond_pickaxe.json
│   └── magic_pickaxe.json # 包含 recipes 和 wiki 的示例
├── itemsIndex.json         # 物品文件索引
├── recipes.json            # 全局配方（可选）
├── recipeTypes.json        # 配方类型定义
└── tags.json               # 标签定义
```

## manifest.json 配置

```json
{
  "packId": "single-item-demo",
  "gameId": "demo",
  "displayName": "Single Item Demo Pack",
  "version": "0.1.0",
  "files": {
    "items": "items/", // 以 / 结尾表示目录模式
    "itemsIndex": "itemsIndex.json", // 物品文件索引
    "tags": "tags.json",
    "recipeTypes": "recipeTypes.json",
    "recipes": "recipes.json" // 全局配方（可选）
  }
}
```

## 物品文件格式

### 基本格式

```json
{
  "key": {
    "id": "demo.base.item_id",
    "meta": 0,
    "nbt": {}
  },
  "name": "物品名称",
  "iconSprite": {
    "url": "/packs/pack-id/icons.webp",
    "position": "0px 0px",
    "size": 64,
    "color": "#ffffff"
  },
  "tags": ["tag1", "tag2"],
  "description": "物品描述"
}
```

### 包含配方的格式

```json
{
  "key": { "id": "demo.base.magic_pickaxe" },
  "name": "Magic Pickaxe",
  "description": "一把神奇的镐子",
  "recipes": [
    {
      "id": "demo.magic_pickaxe_crafting",
      "type": "demo.crafting_table",
      "slotContents": {
        "in1": {
          "kind": "item",
          "id": "demo.base.diamond_pickaxe",
          "amount": 1
        },
        "in2": {
          "kind": "item",
          "id": "demo.base.enchantment_book",
          "amount": 1
        },
        "out1": {
          "kind": "item",
          "id": "demo.base.magic_pickaxe",
          "amount": 1
        }
      },
      "params": {
        "time": 5
      }
    }
  ]
}
```

### 包含 Wiki 的格式

```json
{
  "key": { "id": "demo.base.magic_pickaxe" },
  "name": "Magic Pickaxe",
  "description": "一把神奇的镐子",
  "wiki": {
    "title": "神奇镐子",
    "content": [
      {
        "type": "paragraph",
        "text": "神奇镐子是一把高级挖掘工具。"
      },
      {
        "type": "heading",
        "level": 2,
        "text": "属性"
      },
      {
        "type": "list",
        "items": ["挖掘速度：+150%", "耐久度：500"]
      }
    ],
    "stats": {
      "durability": 500,
      "mining_speed": "150%"
    }
  }
}
```

## itemsIndex.json 格式

`itemsIndex.json` 是一个字符串数组，列出了所有物品文件的相对路径：

```json
["items/iron_ore.json", "items/iron_ingot.json", "items/magic_pickaxe.json"]
```

## 字段说明

### ItemDef 扩展字段

| 字段          | 类型                    | 说明                       |
| ------------- | ----------------------- | -------------------------- |
| `key`         | ItemKey                 | 物品的唯一标识             |
| `name`        | string                  | 物品显示名称               |
| `iconSprite`  | object                  | 物品图标精灵               |
| `tags`        | string[]                | 物品标签                   |
| `description` | string                  | 物品描述                   |
| `recipes`     | InlineRecipe[]          | 物品相关的配方数组（可选） |
| `wiki`        | Record<string, unknown> | Wiki 文档数据（可选）      |

### InlineRecipe 字段

| 字段           | 类型                        | 说明         |
| -------------- | --------------------------- | ------------ |
| `id`           | string                      | 配方唯一ID   |
| `type`         | string                      | 配方类型     |
| `slotContents` | Record<string, SlotContent> | 槽位内容     |
| `params`       | Record<string, unknown>     | 配方参数     |
| `inlineItems`  | ItemDef[]                   | 内联物品定义 |

## 使用场景

### 适用场景

1. **大型物品库**：当物品数量很多时，单文件格式更便于管理
2. **动态更新**：可以单独更新某个物品而无需重载整个数据包
3. **模块化内容**：不同物品可以由不同团队维护
4. **版本控制**：每个物品独立，Git 历史更清晰

### 与传统格式的对比

| 特性     | 数组格式 (items.json) | 单物品格式 (items/) |
| -------- | --------------------- | ------------------- |
| 文件数量 | 1个大文件             | N个小文件           |
| 加载速度 | 快                    | 稍慢（多个请求）    |
| 维护性   | 差（大文件）          | 好（独立文件）      |
| 灵活性   | 低                    | 高                  |
| 适用场景 | 小型数据包            | 大型数据包          |

## 混合模式

数据包支持混合模式：

- 使用 `recipes.json` 存放全局配方
- 在物品文件中使用 `recipes` 字段定义物品专属配方
- 系统会自动合并这两种配方

## Wiki 数据结构

`wiki` 字段可以是任意结构，建议使用以下格式：

```json
{
  "title": "标题",
  "content": [
    { "type": "paragraph", "text": "段落文本" },
    { "type": "heading", "level": 2, "text": "标题" },
    { "type": "list", "items": ["项目1", "项目2"] }
  ],
  "stats": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

## 注意事项

1. `itemsIndex.json` 必须包含所有物品文件
2. 物品文件的 `key.id` 必须唯一
3. 配方的 `id` 也必须唯一
4. Wiki 数据结构可以根据需要自定义
5. `manifest.json` 中的 `items` 字段必须以 `/` 结尾才能启用目录模式
