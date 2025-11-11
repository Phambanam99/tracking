import { ApiProperty } from '@nestjs/swagger';

export class AircraftEditHistoryDto {
  @ApiProperty({ description: 'Edit history ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Aircraft ID', example: 1 })
  aircraftId: number;

  @ApiProperty({ description: 'User who made the edit', example: 1 })
  userId: number;

  @ApiProperty({ description: 'Username of the editor', example: 'john_doe' })
  userName: string;

  @ApiProperty({
    description: 'Changes made (JSON)',
    example: '{"callSign":"VNA123","operator":"Vietnam Airlines"}',
  })
  changes: Record<string, any>;

  @ApiProperty({ description: 'When the edit was made' })
  editedAt: Date;
}

export class AircraftEditHistoryResponseDto {
  @ApiProperty({ type: [AircraftEditHistoryDto] })
  data: AircraftEditHistoryDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;
}
