import { Route, Routes } from "react-router-dom";
import { ChangesPage } from "../features/changes";
import { ReceiptPage } from "../features/receipts";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ChangesPage />} />
      <Route path="/changes" element={<ChangesPage />} />
      <Route path="/changes/:commitSha" element={<ReceiptPage />} />
    </Routes>
  );
}
