import type { ChangeEvent } from 'react';
import { isValidDate, shiftDate } from '../domain/booking';

type DateNavigatorProps = {
  date: string;
  today: string;
  onChange: (date: string) => void;
};

export const DateNavigator = ({ date, today, onChange }: DateNavigatorProps) => {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isValidDate(event.target.value)) onChange(event.target.value);
  };

  return (
    <nav className="date-nav" aria-label="Выбор даты">
      <button
        type="button"
        className="button button--icon"
        aria-label="Предыдущий день"
        onClick={() => onChange(shiftDate(date, -1))}
      >
        ‹
      </button>
      <label className="date-nav__field">
        <span className="visually-hidden">Дата бронирования</span>
        <input className="input" type="date" value={date} onChange={handleInputChange} />
      </label>
      <button
        type="button"
        className="button button--icon"
        aria-label="Следующий день"
        onClick={() => onChange(shiftDate(date, 1))}
      >
        ›
      </button>
      <button
        type="button"
        className="button"
        disabled={date === today}
        onClick={() => onChange(today)}
      >
        Сегодня
      </button>
    </nav>
  );
};
