import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Home Page', () => {
  it('renders without crashing', () => {
    render(<Page />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('displays the main content', () => {
    render(<Page />);
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
  });
}); 