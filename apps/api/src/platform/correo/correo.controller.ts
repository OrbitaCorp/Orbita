import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { SoloSuperadmin, SuperadminYMarketing, TodoElEquipo } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { SUBIDA_IMAGEN } from '../../common/utils/subida-imagen';
import { CorreoPlataformaService } from './correo.service';
import { EnviarCorreoDto, UpsertCasillaDto, VistaPreviaCorreoDto } from './correo.dto';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Pestaña Correo del super panel. Leer (casillas, enviados, vista previa) lo
// puede cualquier admin; tocar las casillas es solo de SUPERADMIN. Enviar es de SUPERADMIN y MARKETING:
// es escribirle a un tercero en nombre de Órbita, desde la casilla elegida.
@UseGuards(PlatformAdminGuard)
@Controller('platform/correo')
export class CorreoPlataformaController {
  constructor(private readonly correo: CorreoPlataformaService) {}

  @Get('casillas')
  @TodoElEquipo()
  casillas() {
    return this.correo.casillas();
  }

  @Post('casillas')
  @SoloSuperadmin()
  crearCasilla(@Body() dto: UpsertCasillaDto) {
    return this.correo.crearCasilla(dto);
  }

  @Put('casillas/:id')
  @SoloSuperadmin()
  editarCasilla(@Param('id') id: string, @Body() dto: UpsertCasillaDto) {
    return this.correo.editarCasilla(id, dto);
  }

  @Delete('casillas/:id')
  @SoloSuperadmin()
  borrarCasilla(@Param('id') id: string) {
    return this.correo.borrarCasilla(id);
  }

  @Post('firma-imagen')
  @SoloSuperadmin()
  @UseInterceptors(FileInterceptor('file', SUBIDA_IMAGEN))
  subirImagenFirma(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Falta el archivo "file"');
    return this.correo.subirImagenFirma(file);
  }

  @Post('vista-previa')
  @TodoElEquipo()
  vistaPrevia(@Body() dto: VistaPreviaCorreoDto) {
    return this.correo.vistaPrevia(dto);
  }

  @Post('enviar')
  @SuperadminYMarketing()
  enviar(@Req() req: RequestWithAdmin, @Body() dto: EnviarCorreoDto) {
    return this.correo.enviar(req.user.adminId, dto);
  }

  @Get('enviados')
  @TodoElEquipo()
  enviados() {
    return this.correo.enviados();
  }
}
