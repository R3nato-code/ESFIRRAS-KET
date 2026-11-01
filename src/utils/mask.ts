export const formatPhoneNumber = (value: string) => {
  // Remove tudo que não é número
  const digits = value.replace(/\D/g, '');

  // Limita a 11 dígitos (DDD + 9 dígitos)
  const truncated = digits.slice(0, 11);

  // Aplica a máscara
  return truncated
    .replace(/^(\d{2})(\d)/g, '($1) $2') // Adiciona DDD: (XX)
    .replace(/(\d{5})(\d)/, '$1-$2');     // Adiciona o hífen: XXXXX-XXXX
};