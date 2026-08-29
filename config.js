/* Conexion a Supabase.

   Estas dos claves son publicas por diseno: la clave anon solo permite
   lo que dejen las politicas RLS del esquema (sql/schema.sql), que
   limitan cada fila a su dueno. Por eso puede vivir en el repositorio.

   Mientras esto no se rellene la app funciona igual, guardando en el
   navegador; al configurarlo, sincroniza entre dispositivos. */

var CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU-CLAVE-ANON"
};
