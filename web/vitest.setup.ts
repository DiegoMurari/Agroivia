import { config } from "dotenv";

// Os testes opcionais das janelas leem PACOTE_DIR. Nenhum teste depende de DEMO_AGORA
// (o instante entra por parâmetro) nem de DB_PATH (banco de teste vem de createTestDb()).
config({ path: ".env", quiet: true });
delete process.env.DB_PATH;
