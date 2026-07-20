import { Route, Routes } from "react-router-dom";
import { PipelineDock } from "./components/PipelineDock";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AdminDashboard from "./pages/AdminDashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SellerDashboard from "./pages/SellerDashboard";

export default function App() {
  return (
    <>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute role="seller">
            <SellerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Landing />} />
      </Routes>
      <PipelineDock />
    </>
  );
}
