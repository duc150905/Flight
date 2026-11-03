import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function renderTabs(pathname) {
  const calls = [];
  const state = { searchOpen: false, openSearch() { state.searchOpen = true; }, closeSearch() { state.searchOpen = false; } };
  const element = (type, props) => ({ type, props });
  const modules = {
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'expo-router': { usePathname: () => pathname, router: { canGoBack: () => true, back: () => calls.push('back'), replace: href => calls.push(JSON.parse(JSON.stringify(href))) } },
    zustand: { useStore: () => state },
    'expo-image': { Image: 'Image' },
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/features/i18n/provider': { useLanguage: () => ({ t: value => value }) },
    '@/features/discovery/search-state': { searchStore: {} },
  };
  const source = readFileSync(new URL('../src/components/bottom-tab-bar.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  runInNewContext(outputText, { exports, require: id => { assert.ok(id in modules, id); return modules[id]; } });
  const tabs = exports.BottomTabBar().props.children.props.children;
  return { calls, state, press: label => tabs.find(tab => tab.props.accessibilityLabel === label).props.onPress() };
}

test('Home from a receipt goes to home even when navigation history exists', () => {
  const ui = renderTabs('/receipt/example'); ui.state.searchOpen = true;
  ui.press('Trang chủ');
  assert.deepEqual(ui.calls, ['/']); assert.equal(ui.state.searchOpen, false);
});

test('Explore from a pending booking opens home search rather than the previous screen', () => {
  const ui = renderTabs('/pending/example'); ui.press('Khám phá');
  assert.deepEqual(ui.calls, [{ pathname: '/', params: { search: '1' } }]);
  assert.equal(ui.state.searchOpen, true);
});

test('Home and Explore on home only toggle search without navigating', () => {
  const ui = renderTabs('/'); ui.press('Khám phá'); assert.equal(ui.state.searchOpen, true);
  ui.press('Trang chủ'); assert.equal(ui.state.searchOpen, false); assert.deepEqual(ui.calls, []);
});
