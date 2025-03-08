import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, ViewChild } from '@angular/core';
import { GoogleMap, GoogleMapsModule } from '@angular/google-maps';
import { environment } from '../../environmensts/environment';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [GoogleMapsModule, HttpClientModule, CommonModule],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent {
  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;

  mapOptions: google.maps.MapOptions = {
    center: { lat: -15.7801, lng: -47.9292 },
    zoom: 4,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    disableDoubleClickZoom: true,
    mapTypeControl: false,
  };

  polygons: google.maps.Polygon[] = [];
  mapData: any[] = [];
  geometryTypes: { name: string; enabled: boolean }[] = [
    { name: 'Imóvel', enabled: true },
    { name: 'Vegetação nativa', enabled: true },
    { name: 'Área de Preservação Permanente', enabled: true },
    { name: 'Pousio', enabled: true },
    { name: 'Área consolidada', enabled: true },
    { name: 'Hidrografia', enabled: true },
    { name: 'Uso restrito', enabled: true },
    { name: 'Servidão administrativa', enabled: true },
    { name: 'Reserva legal', enabled: true },
    { name: 'Desmatamento', enabled: true },
    { name: 'Bioma', enabled: true },
    { name: 'Focos de queimada', enabled: true }
  ];
  isFilterOpen: boolean = false;
  selectedPolygon: any = null; // Armazena os dados do polígono clicado

  constructor(private http: HttpClient) { }

  toggleFilters() {
    this.isFilterOpen = !this.isFilterOpen;
  }

  onMapDblClick(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      console.log(`Latitude: ${lat}, Longitude: ${lng}`);

      Swal.fire({
        title: 'Carregando...',
        text: 'Buscando dados do imóvel',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      this.fetchCarCode(lat, lng);
    }
  }

  fetchCarCode(lat: number, lng: number) {
    const apiUrl = [environment.api, `consulta/busca-car?latitude=${lat}&longitude=${lng}`].join('/');
    this.http.get<any[]>(apiUrl).subscribe(
      (data) => {
        console.log('Dados do busca-car:', data);
        if (data && data.length > 0 && data[0].cod_imovel) {
          const carCode = data[0].cod_imovel;
          console.log(`Código do imóvel encontrado: ${carCode}`);
          this.fetchPropertyData(carCode);
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Nenhum imóvel encontrado',
            text: 'Não foi encontrado um código de imóvel na área clicada.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#007bff'
          });
          console.log('Nenhum código de imóvel encontrado.');
        }
      },
      (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Erro',
          text: 'Ocorreu um erro ao buscar o imóvel. Tente novamente.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#007bff'
        });
        console.error('Erro ao consultar busca-car:', error);
      }
    );
  }

  fetchPropertyData(carCode: string) {
    const apiUrl = [
      environment.api,
      `poligono/imovel?codImovel=${carCode}&imovel=true&app=true&consolidada=true&hidrografia=true&pousio=true&reserva=true&restrito=true&servidao=true&vegetacao=true&bioma=true&desmatamento=true&bioma=true&focoQueimada=true`
    ].join('/');

    this.http.get<any[]>(apiUrl).subscribe(
      (data) => {
        this.clearMap();
        console.log('Dados da API poligono/imovel:', data);
        this.mapData = data;
        this.updateMap();
      },
      (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Erro',
          text: 'Ocorreu um erro ao carregar os dados do imóvel.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#007bff'
        });
        console.error('Erro ao consultar poligono/imovel:', error);
      }
    );
  }

  clearMap() {
    this.polygons.forEach(polygon => polygon.setMap(null));
    this.polygons = [];
  }

  updateMap() {
    this.clearMap();
    const filteredData = this.mapData.filter(item =>
      this.geometryTypes.some(type => type.name === item.tipoGeometria && type.enabled)
    );
    this.displayGeoJsonArray(filteredData);
  }

  displayGeoJsonArray(data: any[]) {
    const bounds = new google.maps.LatLngBounds();

    data.forEach((item, index) => {
      const geojson = item.geojson;
      const color = this.normalizeColor(item.cor_normal);

      if (geojson.type === 'Polygon') {
        this.addPolygon(geojson.coordinates, color, bounds, item, index);
      } else if (geojson.type === 'MultiPolygon') {
        geojson.coordinates.forEach((polygonCoords: any[]) => {
          this.addPolygon(polygonCoords, color, bounds, item, index);
        });
      }
    });

    if (this.polygons.length > 0 && this.map.googleMap) {
      // Fecha o loading primeiro
      Swal.close();
      // Aplica o fitBounds após o loading estar fechado
      setTimeout(() => {
        this.map?.googleMap?.fitBounds(bounds);
      }, 1000); // Pequeno atraso para garantir que o mapa esteja pronto
    } else {
      Swal.close(); // Fecha imediatamente se não houver polígonos
    }
  }

  addPolygon(coordinates: any[], color: string, bounds: google.maps.LatLngBounds, item: any, index: number) {
    const paths = coordinates.map((ring: any[]) =>
      ring.map((coord: number[]) => ({ lat: coord[0], lng: coord[1] }))
    );

    const polygon = new google.maps.Polygon({
      paths: paths,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.35
    });

    polygon.setMap(this.map.googleMap!);
    this.polygons.push(polygon);

    paths.forEach(ring => {
      ring.forEach(coord => {
        bounds.extend(coord);
      });
    });

    // Adiciona evento de clique ao polígono
    google.maps.event.addListener(polygon, 'click', () => {
      this.showPolygonDetails(item);
    });
  }

  // Exibe os detalhes do polígono em um modal
  showPolygonDetails(item: any) {
    const htmlContent = `
    <div style="text-align: left;">
      <p>Código do Imóvel: <strong>${item.codImovel}</strong></p>
      <p><strong>Tipo de Geometria:</strong> ${item.tipoGeometria}</p>
      <p><strong>Município:</strong> ${item.municipio}</p>
      <p><strong>Tema:</strong> ${item.nom_tema || 'N/A'}</p>
      <p><strong>Biomas:</strong> ${item.biomas}</p>
    </div>
  `;

    Swal.fire({
      title: item.descricao || 'Detalhes do Polígono',
      html: htmlContent,
      icon: 'info',
      confirmButtonText: 'Fechar',
      confirmButtonColor: '#007bff',
      width: '400px'
    });
  }

  closeModal() {
    this.selectedPolygon = null; // Fecha o modal limpando os dados
  }

  normalizeColor(color: string): string {
    if (color.startsWith('#') && color.length === 9) {
      return `#${color.slice(3)}`;
    }
    return color;
  }

  onCheckboxChange() {
    this.updateMap();
  }
}