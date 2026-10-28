/** What a click or drag on a page does. */
export type EditorTool = 'select' | 'draw' | 'add-text' | 'edit-text';

export interface ToolDescription {
  readonly tool: EditorTool;
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
}

export const TOOL_DESCRIPTIONS: readonly ToolDescription[] = [
  {
    tool: 'select',
    label: 'Select',
    hint: 'Click an edit to select it, drag to move it, press Delete to remove it.',
    icon: '↖',
  },
  {
    tool: 'draw',
    label: 'Draw',
    hint: 'Drag on the page to draw freehand.',
    icon: '✎',
  },
  {
    tool: 'add-text',
    label: 'Add text',
    hint: 'Drag a box on the page, then type into it.',
    icon: 'T',
  },
  {
    tool: 'edit-text',
    label: 'Edit text',
    hint: 'Click any existing text on the page to replace its wording.',
    icon: '✐',
  },
];
