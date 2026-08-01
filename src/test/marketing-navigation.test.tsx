import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MainLayout from '@/components/MainLayout';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { describe, expect, it } from 'vitest';

describe('MainLayout marketing navigation', () => {
  it('shows the simplified marketing nav links only', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route index element={<div>Landing</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    const nav = screen.getByRole('navigation', { name: /primary navigation/i });
    const navLinks = within(nav).getAllByRole('link');

    expect(navLinks.map((link) => link.textContent)).toEqual(['Home', 'How it works', 'Trust']);

    expect(screen.getByRole('link', { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^create account$/i })).toBeInTheDocument();
  });
});
