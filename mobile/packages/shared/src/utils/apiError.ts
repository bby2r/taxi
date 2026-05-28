/**
 * Достаёт человекочитаемое сообщение об ошибке из axios-исключения.
 * Сервер обычно возвращает `{message: '...'}` для 422 — оно полезное
 * для пользователя. Любая другая форма падает на fallback.
 */
export function getApiErrorMessage(e: unknown, fallback: string): string {
  const axiosError = e as { response?: { data?: { message?: string } } };
  return axiosError.response?.data?.message ?? fallback;
}
