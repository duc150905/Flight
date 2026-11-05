import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAdminI18n } from './i18n';
import { filterAndPaginate } from './model';
import { AdminPaginationBar, AdminTextField, adminStyles } from './ui';

/** Keep large catalogues searchable without mounting thousands of buttons on mobile. */
export function CataloguePicker<T extends { id: string }>({ items, value, label, getLabel, onSelect }: {
  items: T[]; value: string; label: string; getLabel: (item: T) => string; onSelect: (item: T) => void;
}) {
  const { bi } = useAdminI18n();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const result = filterAndPaginate(items, { query, page, pageSize: 12, statusFilter: 'all', getSearchText: getLabel, getIsActive: () => true });
  const selected = items.find(item => item.id === value);
  return <View style={adminStyles.fieldGroup}>
    <AdminTextField label={label} value={query} onChangeText={text => { setQuery(text); setPage(1); }}
      placeholder={bi('Tìm để chọn…', 'Search to select…')} />
    {!!selected && <Text style={adminStyles.muted}>{bi('Đã chọn:', 'Selected:')} {getLabel(selected)}</Text>}
    <View style={adminStyles.chipRow}>{result.items.map(item => <Pressable key={item.id} accessibilityRole="button"
      accessibilityState={{ selected: item.id === value }} onPress={() => onSelect(item)}
      style={[adminStyles.chip, item.id === value && adminStyles.chipSelected]}>
      <Text style={[adminStyles.chipText, item.id === value && adminStyles.chipTextSelected]}>{getLabel(item)}</Text>
    </Pressable>)}</View>
    <AdminPaginationBar page={result.page} totalPages={result.totalPages} total={result.total} onPageChange={setPage} />
  </View>;
}
