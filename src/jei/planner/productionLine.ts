import type { ItemKey } from 'src/jei/types';
import { itemKeyHash } from 'src/jei/indexing/key';
import type { EnhancedRequirementNode, RequirementNode } from './planner';

type AnyNode = RequirementNode | EnhancedRequirementNode;

export type ProductionLineNode =
  | {
    kind: 'item';
    nodeId: string;
    itemKey: ItemKey;
    amount: number;
    seedAmount?: number;
    isRoot?: true;
  }
  | {
    kind: 'fluid';
    nodeId: string;
    id: string;
    amount: number;
    unit?: string;
  }
  | {
    kind: 'machine';
    nodeId: string;
    recipeId: string;
    recipeTypeKey?: string;
    outputItemKey: ItemKey;
    amount: number;
    machineItemId?: string;
    machineName?: string;
    machineCount?: number;
    machines?: number;
  };

export type ProductionLineEdge =
  | {
    kind: 'item';
    id: string;
    source: string;
    target: string;
    itemKey: ItemKey;
    amount: number;
  }
  | {
    kind: 'fluid';
    id: string;
    source: string;
    target: string;
    fluidId: string;
    unit?: string;
    amount: number;
  };

type ItemEdge = Extract<ProductionLineEdge, { kind: 'item' }>;
type FluidEdge = Extract<ProductionLineEdge, { kind: 'fluid' }>;
type ItemEdgeDraft = Omit<ItemEdge, 'id'>;
type FluidEdgeDraft = Omit<FluidEdge, 'id'>;
type EdgeDraft = ItemEdgeDraft | FluidEdgeDraft;

function finiteOr(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function buildProductionLineModel(args: {
  root: AnyNode;
  rootItemKey?: ItemKey;
  includeCycleSeeds?: boolean;
  collapseIntermediateItems?: boolean;
}): { nodes: ProductionLineNode[]; edges: ProductionLineEdge[] } {
  const rootItemKey = args.rootItemKey ?? (args.root.kind === 'item' ? args.root.itemKey : undefined);
  const rootKeyHash = rootItemKey ? itemKeyHash(rootItemKey) : null;
  const includeCycleSeeds = !!args.includeCycleSeeds;
  const collapseIntermediateItems = !!args.collapseIntermediateItems;

  const itemByKeyHash = new Map<
    string,
    { itemKey: ItemKey; seedAmount: number; isRoot?: true }
  >();
  const fluidById = new Map<string, { id: string; unit?: string }>();
  const machineByKey = new Map<
    string,
    {
      recipeId: string;
      recipeTypeKey?: string;
      outputItemKey: ItemKey;
      amount: number;
      machineItemId?: string;
      machineName?: string;
      machineCount?: number;
      machines?: number;
    }
  >();

  const edgeByKey = new Map<string, ProductionLineEdge>();

  const ensureItem = (key: ItemKey) => {
    const h = itemKeyHash(key);
    const prev = itemByKeyHash.get(h);
    if (prev) return { id: `i:${h}`, hash: h };
    itemByKeyHash.set(h, { itemKey: key, seedAmount: 0, ...(h === rootKeyHash ? { isRoot: true } : {}) });
    return { id: `i:${h}`, hash: h };
  };

  const ensureFluid = (id: string, unit?: string) => {
    const k = unit ? `${id}:${unit}` : id;
    const prev = fluidById.get(k);
    if (!prev) fluidById.set(k, { id, ...(unit ? { unit } : {}) });
    return { id: `f:${k}`, key: k };
  };

  const ensureMachine = (node: Extract<AnyNode, { kind: 'item' }>) => {
    const recipeId = node.recipeIdUsed;
    if (!recipeId) return null;
    const outHash = itemKeyHash(node.itemKey);
    const k = `${recipeId}:${outHash}`;
    const prev = machineByKey.get(k);
    if (!prev) {
      machineByKey.set(k, {
        recipeId,
        ...(node.recipeTypeKeyUsed ? { recipeTypeKey: node.recipeTypeKeyUsed } : {}),
        outputItemKey: node.itemKey,
        amount: 0,
        ...(node.machineItemId ? { machineItemId: node.machineItemId } : {}),
        ...(node.machineName ? { machineName: node.machineName } : {}),
      });
    } else {
      if (!prev.machineItemId && node.machineItemId) prev.machineItemId = node.machineItemId;
      if (!prev.machineName && node.machineName) prev.machineName = node.machineName;
      if (!prev.recipeTypeKey && node.recipeTypeKeyUsed) prev.recipeTypeKey = node.recipeTypeKeyUsed;
    }
    return { id: `m:${k}`, key: k };
  };

  const addEdge = (edge: EdgeDraft) => {
    const k =
      edge.kind === 'item'
        ? `${edge.source}->${edge.target}:i:${itemKeyHash(edge.itemKey)}`
        : `${edge.source}->${edge.target}:f:${edge.fluidId}:${edge.unit ?? ''}`;
    const prev = edgeByKey.get(k);
    if (!prev) {
      edgeByKey.set(k, { ...(edge as ProductionLineEdge), id: `e:${k}` });
      return;
    }
    prev.amount += edge.amount;
  };

  const addMachineTotals = (machineKey: string, node: Extract<AnyNode, { kind: 'item' }>) => {
    const m = machineByKey.get(machineKey);
    if (!m) return;
    const mc = finiteOr((node as unknown as { machineCount?: unknown }).machineCount, 0);
    const machines = finiteOr((node as unknown as { machines?: unknown }).machines, 0);
    if (Number.isFinite(mc) && mc > 0) m.machineCount = (m.machineCount ?? 0) + mc;
    if (Number.isFinite(machines) && machines > 0) m.machines = (m.machines ?? 0) + machines;
  };

  const walk = (node: AnyNode) => {
    if (node.kind === 'fluid') {
      ensureFluid(node.id, node.unit);
      return;
    }

    const item = ensureItem(node.itemKey);
    const itemAgg = itemByKeyHash.get(item.hash)!;
    const seedAmount = finiteOr(
      (node as unknown as { cycleSeedAmount?: unknown }).cycleSeedAmount,
      0,
    );
    if (includeCycleSeeds && node.cycleSeed && seedAmount > 0) {
      itemAgg.seedAmount += seedAmount;
    }

    const canBuildMachine = !!node.recipeIdUsed && !node.cycle;
    const machine = canBuildMachine ? ensureMachine(node) : null;
    if (machine) {
      const mAgg = machineByKey.get(machine.key)!;
      mAgg.amount += finiteOr(node.amount, 0);
      addMachineTotals(machine.key, node);
      addEdge({
        kind: 'item',
        source: machine.id,
        target: item.id,
        itemKey: node.itemKey,
        amount: finiteOr(node.amount, 0),
      });

      node.children.forEach((c) => {
        if (c.kind === 'item') {
          const childItem = ensureItem(c.itemKey);
          const cycleAmountNeeded = finiteOr(
            (c as unknown as { cycleAmountNeeded?: unknown }).cycleAmountNeeded,
            0,
          );
          const amount = c.cycleSeed && cycleAmountNeeded > 0 ? cycleAmountNeeded : finiteOr(c.amount, 0);
          addEdge({
            kind: 'item',
            source: childItem.id,
            target: machine.id,
            itemKey: c.itemKey,
            amount,
          });
        } else {
          const childFluid = ensureFluid(c.id, c.unit);
          addEdge({
            kind: 'fluid',
            source: childFluid.id,
            target: machine.id,
            fluidId: c.id,
            ...(c.unit ? { unit: c.unit } : {}),
            amount: finiteOr(c.amount, 0),
          });
        }
      });
    }

    if (node.children.length) node.children.forEach(walk);
  };

  walk(args.root);

  const amountByNodeId = new Map<string, number>();
  Array.from(edgeByKey.values()).forEach((e) => {
    if (e.kind === 'item') {
      const isFromMachine = e.source.startsWith('m:');
      const isToMachine = e.target.startsWith('m:');
      if (isFromMachine) {
        amountByNodeId.set(e.target, (amountByNodeId.get(e.target) ?? 0) + e.amount);
      } else if (isToMachine) {
        amountByNodeId.set(e.source, (amountByNodeId.get(e.source) ?? 0) + e.amount);
      }
    } else {
      amountByNodeId.set(e.source, (amountByNodeId.get(e.source) ?? 0) + e.amount);
    }
  });

  let nodes: ProductionLineNode[] = [];
  itemByKeyHash.forEach((v, h) => {
    const nodeId = `i:${h}`;
    const amount = amountByNodeId.get(nodeId) ?? 0;
    nodes.push({
      kind: 'item',
      nodeId,
      itemKey: v.itemKey,
      amount,
      ...(v.seedAmount > 0 ? { seedAmount: v.seedAmount } : {}),
      ...(v.isRoot ? { isRoot: true } : {}),
    });
  });
  fluidById.forEach((v, k) => {
    const nodeId = `f:${k}`;
    const amount = amountByNodeId.get(nodeId) ?? 0;
    nodes.push({
      kind: 'fluid',
      nodeId,
      id: v.id,
      ...(v.unit ? { unit: v.unit } : {}),
      amount,
    });
  });
  machineByKey.forEach((v, k) => {
    nodes.push({
      kind: 'machine',
      nodeId: `m:${k}`,
      recipeId: v.recipeId,
      ...(v.recipeTypeKey ? { recipeTypeKey: v.recipeTypeKey } : {}),
      outputItemKey: v.outputItemKey,
      amount: v.amount,
      ...(v.machineItemId ? { machineItemId: v.machineItemId } : {}),
      ...(v.machineName ? { machineName: v.machineName } : {}),
      ...(v.machineCount !== undefined ? { machineCount: v.machineCount } : {}),
      ...(v.machines !== undefined ? { machines: v.machines } : {}),
    });
  });

  let edges: ProductionLineEdge[] = Array.from(edgeByKey.values());

  if (collapseIntermediateItems) {
    const itemNodes = nodes.filter((n): n is Extract<ProductionLineNode, { kind: 'item' }> => n.kind === 'item');
    const removedItemNodeIds = new Set<string>();
    const removeEdgeIds = new Set<string>();
    const addedEdges: EdgeDraft[] = [];

    const incomingByItem = new Map<string, ItemEdge[]>();
    const outgoingByItem = new Map<string, ItemEdge[]>();
    itemNodes.forEach((n) => {
      incomingByItem.set(n.nodeId, []);
      outgoingByItem.set(n.nodeId, []);
    });
    edges.forEach((e) => {
      if (e.kind !== 'item') return;
      if (e.target.startsWith('i:')) (incomingByItem.get(e.target) ?? []).push(e);
      if (e.source.startsWith('i:')) (outgoingByItem.get(e.source) ?? []).push(e);
    });

    itemNodes.forEach((n) => {
      const incoming = (incomingByItem.get(n.nodeId) ?? []).filter((e) => e.source.startsWith('m:'));
      const outgoing = (outgoingByItem.get(n.nodeId) ?? []).filter((e) => e.target.startsWith('m:'));
      const keep =
        !!n.isRoot || (n.seedAmount ?? 0) > 0 || incoming.length === 0 || outgoing.length === 0;
      if (keep) return;

      const producer = incoming
        .slice()
        .sort((a, b) => b.amount - a.amount)[0];
      if (!producer) return;

      incoming.forEach((e) => removeEdgeIds.add(e.id));
      outgoing.forEach((e) => removeEdgeIds.add(e.id));
      removedItemNodeIds.add(n.nodeId);

      outgoing.forEach((cons) => {
        addedEdges.push({
          kind: 'item',
          source: producer.source,
          target: cons.target,
          itemKey: cons.itemKey,
          amount: cons.amount,
        });
      });
    });

    const mergeEdgeKey = (e: EdgeDraft) =>
      e.kind === 'item'
        ? `${e.source}->${e.target}:i:${itemKeyHash(e.itemKey)}`
        : `${e.source}->${e.target}:f:${e.fluidId}:${e.unit ?? ''}`;

    const merged = new Map<string, ProductionLineEdge>();
    const addMerged = (e: EdgeDraft) => {
      const k = mergeEdgeKey(e);
      const prev = merged.get(k);
      if (!prev) {
        merged.set(k, { ...(e as ProductionLineEdge), id: `e:${k}` });
        return;
      }
      prev.amount += e.amount;
    };

    edges
      .filter((e) => !removeEdgeIds.has(e.id))
      .filter((e) => !removedItemNodeIds.has(e.source) && !removedItemNodeIds.has(e.target))
      .forEach((e) => {
        if (e.kind === 'item') addMerged({ kind: 'item', source: e.source, target: e.target, itemKey: e.itemKey, amount: e.amount });
        else
          addMerged({
            kind: 'fluid',
            source: e.source,
            target: e.target,
            fluidId: e.fluidId,
            ...(e.unit ? { unit: e.unit } : {}),
            amount: e.amount,
          });
      });
    addedEdges.forEach((e) => addMerged(e));

    edges = Array.from(merged.values());
    nodes = nodes.filter((n) => !removedItemNodeIds.has(n.nodeId));

    const amountByFinalNodeId = new Map<string, number>();
    edges.forEach((e) => {
      if (e.kind === 'item') {
        const isFromMachine = e.source.startsWith('m:');
        const isToMachine = e.target.startsWith('m:');
        const isFromItem = e.source.startsWith('i:');
        const isToItem = e.target.startsWith('i:');
        if (isFromMachine && isToItem) {
          amountByFinalNodeId.set(e.target, (amountByFinalNodeId.get(e.target) ?? 0) + e.amount);
        } else if (isFromItem && isToMachine) {
          amountByFinalNodeId.set(e.source, (amountByFinalNodeId.get(e.source) ?? 0) + e.amount);
        }
      } else {
        amountByFinalNodeId.set(e.source, (amountByFinalNodeId.get(e.source) ?? 0) + e.amount);
      }
    });

    nodes = nodes.map((n) => {
      if (n.kind === 'item') return { ...n, amount: amountByFinalNodeId.get(n.nodeId) ?? 0 };
      if (n.kind === 'fluid') return { ...n, amount: amountByFinalNodeId.get(n.nodeId) ?? 0 };
      return n;
    });
  }

  return { nodes, edges };
}
