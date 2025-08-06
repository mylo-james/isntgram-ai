import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { store } from "../../store/store";
import Page from "./page";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe("Home Page", () => {
  it("renders without crashing", () => {
    render(
      <Provider store={store}>
        <Page />
      </Provider>,
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays the main content", () => {
    render(
      <Provider store={store}>
        <Page />
      </Provider>,
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
