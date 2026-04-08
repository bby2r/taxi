# Phase 4 Summary: Mobile — Region Order Selector

**Completed**: 2026-04-09
**Commit**: `f01098b`

## What was built

### 4.1: Regions API integration
- `Region` type added to `api/types.ts`
- `api/regions.ts` — `getRegions()` and `getCurrentPrice()` functions
- `createRegionalOrder()` added to `api/orders.ts`

### 4.2: RegionSelector component
- Bottom-sheet modal at `components/RegionSelector.tsx`
- FlatList of regions with name (left) and price (right)
- Loading, error, and empty states
- Overlay tap and "Закрыть" button to dismiss

### 4.3: HomeScreen + useOrder updates
- `useOrder` hook: added `callRegionalTaxi` callback
- HomeScreen: dynamic price from API (replaces FIXED_PRICE constant)
- "Межгород" outline button below "Вызват�� такси"
- RegionSelector wired to create regional orders
- FIXED_PRICE constant removed from codebase
