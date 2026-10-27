export const colors = {
  bg: '#303030',
  card: '#424242',
  header: '#0b2d50',
  dialog: '#424242',
  text: '#e6e6e6',
  muted: '#a0a0a0',
  divider: '#5a5a5a',
  green: '#66bb6a',
  red: '#ef5350',
  accent: '#d4a017',
  teal: '#26a69a',
  backdrop: 'rgba(0,0,0,0.6)',
};

export const amountColor = (n: number) => (n > 0 ? colors.green : n < 0 ? colors.red : colors.muted);
