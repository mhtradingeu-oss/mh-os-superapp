import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;
// Test Route
app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "MH Trading Backend (HAIROTICMEN) is running 🎉",
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map