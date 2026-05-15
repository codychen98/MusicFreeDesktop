import { hideModal, showModal } from "@/renderer/components/Modal";
import i18n from "i18next";

export function confirmEmptyRemoteOverwrite(): Promise<boolean> {
    return new Promise((resolve) => {
        showModal("Reconfirm", {
            title: i18n.t("settings.backup.empty_remote_dialog_title"),
            content: i18n.t("settings.backup.empty_remote_dialog_body"),
            onCancel: () => {
                hideModal();
                resolve(false);
            },
            onConfirm: () => {
                hideModal();
                resolve(true);
            },
        });
    });
}
