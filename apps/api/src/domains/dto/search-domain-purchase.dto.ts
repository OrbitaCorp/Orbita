import { IsString, MaxLength, MinLength } from 'class-validator';

// Texto libre de verdad — el dueño no tiene por qué saber qué TLDs existen
// (pedido explícito: "el usuario desconoce los tipos de dominios que hay").
// Puede escribir solo el nombre ("lenteslindos") o un dominio completo con
// TLD ("lenteslindos.io") — DomainPurchaseService#search() distingue los
// dos casos.
export class SearchDomainPurchaseDto {
  @IsString() @MinLength(2) @MaxLength(63) query!: string;
}
