import {
  Controller,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { InvalidInputError } from '@shared/domain/errors'
import { UploadCatalogImageUseCase } from '../../application/use-cases/upload-catalog-image.use-case'
import { CatalogImageInterceptor } from '../interceptors/catalog-image.interceptor'
import { UploadCatalogImageQuery, UploadedImageResponse } from '../dto/upload.request'

@ApiTags('Admin catalog')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly uploadCatalogImageUseCase: UploadCatalogImageUseCase) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'One JPEG, PNG, WebP or GIF image.',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload a catalog image',
    description:
      'Stores the file under uploads/{folder} and returns a public URL to save on a product, category or brand.',
  })
  @ApiCreatedResponse({ type: UploadedImageResponse, description: 'The stored image URL.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  @UseInterceptors(CatalogImageInterceptor)
  upload(
    @Query() query: UploadCatalogImageQuery,
    @UploadedFile() file: Express.Multer.File | undefined
  ) {
    if (!file) {
      throw new InvalidInputError('An image file is required')
    }

    return this.uploadCatalogImageUseCase.execute({
      folder: query.folder ?? 'products',
      file: {
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      },
    })
  }
}
