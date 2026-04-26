type HandleValidation =
  | { ok: true; handle: string; cleanHandle: string }
  | { ok: false; error: string }

export function validateAndNormalizeHandle(input: unknown): HandleValidation {
  if (typeof input !== 'string') {
    return { ok: false, error: '用户名不能为空' }
  }

  const cleanHandle = input.trim().replace(/^@+/, '')

  if (cleanHandle.length < 2) {
    return { ok: false, error: '用户名至少需要2个字符' }
  }

  if (cleanHandle.length > 32) {
    return { ok: false, error: '用户名不能超过32个字符' }
  }

  if (!/^[a-zA-Z0-9_\u4e00-\u9fff]+$/.test(cleanHandle)) {
    return { ok: false, error: '用户名只能包含字母、数字、下划线或中文' }
  }

  return { ok: true, handle: `@${cleanHandle}`, cleanHandle }
}
