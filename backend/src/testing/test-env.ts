// Deve ser o primeiro import dos testes: define o banco antes de carregar a configuração.
if (!process.env.TEST_DATABASE_URL) throw new Error('Defina TEST_DATABASE_URL');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
