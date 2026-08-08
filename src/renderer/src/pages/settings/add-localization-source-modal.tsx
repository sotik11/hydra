import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Modal, TextField } from "@renderer/components";
import { useForm } from "react-hook-form";
import { logger } from "@renderer/logger";

import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { SyncIcon } from "@primer/octicons-react";
import "./add-localization-source-modal.scss";
import "../game-details/modals/localization-i18n";

interface AddLocalizationSourceModalProps {
  visible: boolean;
  onClose: () => void;
  onAddLocalizationSource: () => void;
}

interface FormValues {
  url: string;
}

export function AddLocalizationSourceModal({
  visible,
  onClose,
  onAddLocalizationSource,
}: Readonly<AddLocalizationSourceModalProps>) {
  const [isLoading, setIsLoading] = useState(false);

  const { t } = useTranslation("settings");

  const schema = yup.object().shape({
    url: yup.string().required(t("required_field")).url(t("must_be_valid_url")),
  });

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      await window.electron.addLocalizationSource(values.url);

      onClose();
      onAddLocalizationSource();
    } catch (error) {
      logger.error("Failed to add localization source:", error);
      const errorMessage =
        error instanceof Error && error.message.includes("already exists")
          ? t("localization:localization_source_already_exists")
          : t("localization:failed_add_localization_source");

      setError("url", {
        type: "server",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setValue("url", "");
    clearErrors();
    setIsLoading(false);
  }, [visible, clearErrors, setValue]);

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      title={t("localization:add_localization_source")}
      description={t("localization:add_localization_source_description")}
      onClose={handleClose}
      clickOutsideToClose={!isLoading}
    >
      <div className="add-localization-source-modal__container">
        <form onSubmit={handleSubmit(onSubmit)}>
          <TextField
            {...register("url")}
            label={t("localization:localization_source_url")}
            placeholder={t("insert_valid_json_url")}
            error={errors.url?.message}
          />

          <div className="add-localization-source-modal__actions">
            <Button
              type="button"
              theme="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t("cancel")}
            </Button>

            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isLoading && (
                <SyncIcon className="add-localization-source-modal__spinner" />
              )}
              {isLoading
                ? t("adding")
                : t("localization:add_localization_source")}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
