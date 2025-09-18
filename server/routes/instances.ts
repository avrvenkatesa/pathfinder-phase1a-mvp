import { Router } from "express";

console.log("Loading instances router...");
const router = Router();

console.log("Registering test GET route...");
router.get("/", async (req, res) => {
  res.json({ message: "Instances route working", test: true });
});

console.log("Instances router ready");
export default router;
