export type Operation = {
  id: string;
  amount: number; // > 0 — долг в плюс, < 0 — в минус
  date: number; // timestamp
  comment: string;
};

export type Contact = {
  id: string;
  name: string;
  createdAt: number;
  groupId?: string | null; // нет — «Без группы»
  operations: Operation[]; // всегда отсортированы по дате по возрастанию
};

export type Group = {
  id: string;
  name: string;
};

export type SortKey = 'name' | 'amount' | 'date';

export type SortSettings = {
  key: SortKey;
  desc: boolean;
  showZero: boolean;
};

export type ViewSettings = {
  mode: 'all' | 'groups';
  groupId: string | null; // выбранная группа в режиме «По группам»; null — «Без группы»
};
