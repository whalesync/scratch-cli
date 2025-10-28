import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { useCsvFiles } from '@/hooks/use-csv-file';
import { CsvFile } from '@/types/server-entities/csv-file';
import { Alert, Group, Modal, ModalProps, Stack, Textarea, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

interface EditCsvFileModalProps extends ModalProps {
  csvFile: CsvFile | null;
}

export const EditCsvFileModal = (props: EditCsvFileModalProps) => {
  const { csvFile, ...modalProps } = props;
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { createCsvFile, updateCsvFile } = useCsvFiles();

  useEffect(() => {
    if (csvFile) {
      setName(csvFile.name);
      setBody(csvFile.body);
    } else {
      setName('');
      setBody('');
    }
  }, [csvFile]);

  const handleSave = async () => {
    if (csvFile) {
      setIsSaving(true);
      setSaveError(null);

      try {
        await updateCsvFile(csvFile.id, {
          name: name.trim(),
          body: body,
        });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsSaving(true);
      setSaveError(null);

      try {
        await createCsvFile({
          name: name.trim(),
          body: body,
        });
        props.onClose();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <Modal title={csvFile ? 'Edit CSV File' : 'Create CSV File'} size="70%" centered {...modalProps}>
      <Stack>
        {saveError && <Alert color="red">{saveError}</Alert>}
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter CSV file name"
          description="The name of the CSV file. This will be used as the table name in the workbook."
        />
        <Textarea
          label="CSV Content"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Enter CSV content here..."
          description="The CSV content will be parsed and displayed in a table. The first column will be used as the identity field and will be readonly."
          minRows={20}
          maxRows={30}
          autosize
          styles={{
            input: {
              fontFamily: 'monospace',
              fontSize: '1rem',
            },
          }}
        />
        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={props.onClose}>Cancel</ButtonSecondaryOutline>
          <ButtonPrimaryLight onClick={handleSave} loading={isSaving}>
            Save
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
};
