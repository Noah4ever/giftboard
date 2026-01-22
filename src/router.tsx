import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import ListPage from "./pages/ListPage";
import CreatePage from "./pages/CreatePage";
import JoinPage from "./pages/JoinPage";
import ProfilePage from "./pages/ProfilePage";

const basename = (import.meta.env.BASE_URL || "/giftboard").replace(/\/+$/, "");

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      children: [
        { index: true, element: <LandingPage /> },
        { path: "create", element: <CreatePage /> },
        { path: "join", element: <JoinPage /> },
        { path: "lists/:code", element: <ListPage /> },
        { path: "me", element: <ProfilePage /> },
      ],
    },
  ],
  {
    basename,
  }
);

export default router;
