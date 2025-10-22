import { Outlet } from "react-router-dom";
import AppNav from "./AppNav";

const Layout = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="md:ml-64 p-4 md:p-8 pb-24 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
