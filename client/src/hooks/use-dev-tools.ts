import { isExperimentEnabled } from "@/types/server-entities/users";
import { useScratchPadUser } from "./useScratchpadUser";

export const useDevTools = () => {
    const {user} = useScratchPadUser();
    const isDevToolsEnabled = isExperimentEnabled('DEV_TOOLBOX', user);
    return {
        isDevToolsEnabled
    }
};