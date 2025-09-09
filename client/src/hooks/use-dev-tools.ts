import { useScratchPadUser } from "./useScratchpadUser";

export const useDevTools = () => {
    const {user} = useScratchPadUser();
    const isDevToolsEnabled = user?.experimentalFlags?.DEV_TOOLBOX;
    return {
        isDevToolsEnabled
    }
};