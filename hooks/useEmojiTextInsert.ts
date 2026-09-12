import { useCallback, useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { insertTextAtSelection, type TextSelection } from '@/lib/text/insertTextAtSelection';

type Options = {
  value: string;
  onChangeText: (text: string) => void;
  selection?: TextSelection;
  onSelectionChange?: (selection: TextSelection) => void;
};

export function useEmojiTextInsert({
  value,
  onChangeText,
  selection,
  onSelectionChange,
}: Options) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [internalSelection, setInternalSelection] = useState<TextSelection>({
    start: value.length,
    end: value.length,
  });

  useEffect(() => {
    if (selection == null) {
      setInternalSelection((prev) => {
        const clampedStart = Math.min(prev.start, value.length);
        const clampedEnd = Math.min(prev.end, value.length);
        if (clampedStart === prev.start && clampedEnd === prev.end) return prev;
        return { start: clampedStart, end: clampedEnd };
      });
    }
  }, [value.length, selection]);

  const effectiveSelection = selection ?? internalSelection;

  const setSelection = useCallback(
    (next: TextSelection) => {
      if (onSelectionChange) onSelectionChange(next);
      else setInternalSelection(next);
    },
    [onSelectionChange]
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      const { text, selection: nextSelection } = insertTextAtSelection(
        value,
        emoji,
        effectiveSelection
      );
      onChangeText(text);
      setSelection(nextSelection);
    },
    [value, onChangeText, effectiveSelection, setSelection]
  );

  const togglePicker = useCallback(() => {
    setPickerOpen((open) => {
      if (!open) Keyboard.dismiss();
      return !open;
    });
  }, []);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  const onInputFocus = useCallback(() => {
    setPickerOpen(false);
  }, []);

  return {
    pickerOpen,
    togglePicker,
    closePicker,
    insertEmoji,
    onInputFocus,
    setSelection,
    effectiveSelection,
  };
}
