import { handleOpenRouter } from "../../server/openrouter";

export default (request: Request) => handleOpenRouter(request, process.env);
