let counter = 0;

/**
 * Счётчик делает id уникальным в пределах запуска, даже когда импорт создаёт тысячи id
 * за одну миллисекунду; случайная часть разводит id разных запусков и устройств.
 */
export const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
