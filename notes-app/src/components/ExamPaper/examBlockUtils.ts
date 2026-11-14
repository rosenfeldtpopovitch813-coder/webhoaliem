import type { ExamBlock } from '../../types/board';

export function moveExamBlock(
  blocks: ExamBlock[],
  blockId: string,
  direction: -1 | 1
): ExamBlock[] {
  const index = blocks.findIndex(b => b.id === blockId);
  if (index < 0) return blocks;
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function duplicateExamBlock(
  blocks: ExamBlock[],
  blockId: string,
  makeId: () => string = () => crypto.randomUUID()
): { blocks: ExamBlock[]; createdId: string | null } {
  const index = blocks.findIndex(b => b.id === blockId);
  if (index < 0) return { blocks, createdId: null };
  const source = blocks[index];
  const createdId = makeId();
  let copy: ExamBlock;
  if (source.type === 'question') {
    copy = {
      ...structuredClone(source),
      id: createdId,
      statements: source.statements?.map(st => ({ ...st, id: makeId() })),
      figures: source.figures?.map(fig => ({ ...fig, id: makeId() }))
    };
  } else {
    copy = { ...structuredClone(source), id: createdId };
  }
  const next = [...blocks];
  next.splice(index + 1, 0, copy);
  return { blocks: next, createdId };
}

export function getFocusedSelectionLabel(
  blocks: ExamBlock[],
  focusedBlockId: string | null,
  questionNumbers: Map<string, number>
): string {
  if (!focusedBlockId) return 'Chưa chọn câu (sẽ thêm vào cuối)';
  const block = blocks.find(b => b.id === focusedBlockId);
  if (!block) return 'Chưa chọn câu';
  if (block.type === 'question') {
    const num = questionNumbers.get(block.id);
    return num ? `Đang chọn: Câu ${num}` : 'Đang chọn: Câu hỏi';
  }
  if (block.type === 'section') return 'Đang chọn: Tiêu đề phần';
  if (block.type === 'paragraph') return 'Đang chọn: Đoạn văn bản';
  return 'Đang chọn khối nội dung';
}
