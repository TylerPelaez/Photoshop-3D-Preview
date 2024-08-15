import { photoshop } from "../lib/globals";

export const notify = async (message: string) => {
  await photoshop.app.showAlert(message);
};
